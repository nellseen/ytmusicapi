import os
import re
import time
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
import httpx
from ytmusicapi import YTMusic
import yt_dlp

# -------------------------------------------------------------
# LOGGING SETUP
# -------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s"
)
logger = logging.getLogger("sonora")

def log_info(msg: str):
    logger.info(f"[INFO] {msg}")

def log_search(msg: str):
    logger.info(f"[SEARCH] {msg}")

def log_stream(msg: str):
    logger.info(f"[STREAM] {msg}")

def log_ytdlp(msg: str):
    logger.info(f"[YT-DLP] {msg}")

def log_lyrics(msg: str):
    logger.info(f"[LYRICS] {msg}")

def log_cache(msg: str):
    logger.info(f"[CACHE] {msg}")

def log_error(msg: str):
    logger.error(f"[ERROR] {msg}")

# -------------------------------------------------------------
# APP INITIALIZATION
# -------------------------------------------------------------
app = FastAPI(title="Sonora Music API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize YTMusic
try:
    ytmusic = YTMusic()
    log_info("Initialized ytmusicapi client successfully.")
except Exception as e:
    log_error(f"Failed to initialize ytmusicapi: {e}")
    ytmusic = None

# -------------------------------------------------------------
# CACHE IMPLEMENTATION (In-Memory with TTL)
# -------------------------------------------------------------
class SimpleCache:
    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        if key in self._store:
            item = self._store[key]
            if item["expires_at"] > time.time():
                return item["value"]
            else:
                del self._store[key]
        return None

    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        self._store[key] = {
            "value": value,
            "expires_at": time.time() + ttl_seconds
        }

    def clear_expired(self):
        now = time.time()
        expired_keys = [k for k, v in self._store.items() if v["expires_at"] <= now]
        for k in expired_keys:
            del self._store[k]

cache = SimpleCache()

# -------------------------------------------------------------
# SANITIZATION HELPERS
# -------------------------------------------------------------
ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.]{1,128}$")

def sanitize_id(identifier: str) -> str:
    identifier = identifier.strip()
    if not ID_REGEX.match(identifier):
        raise HTTPException(
            status_code=400,
            detail={"success": False, "error": f"Invalid identifier format: '{identifier}'"}
        )
    return identifier

def sanitize_query(query: str) -> str:
    cleaned = query.strip()
    if not cleaned or len(cleaned) > 200:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "error": "Query must be between 1 and 200 characters"}
        )
    return cleaned

# -------------------------------------------------------------
# METADATA NORMALIZATION HELPERS
# -------------------------------------------------------------
def get_best_thumbnail(thumbnails: Optional[List[Dict[str, Any]]]) -> str:
    if not thumbnails or not isinstance(thumbnails, list):
        return ""
    # Sort by width or area to get highest resolution
    try:
        sorted_thumbs = sorted(
            thumbnails,
            key=lambda t: (t.get("width", 0) or 0) * (t.get("height", 0) or 0),
            reverse=True
        )
        url = sorted_thumbs[0].get("url", "")
        if url.startswith("//"):
            url = "https:" + url
        return url
    except Exception:
        return thumbnails[-1].get("url", "") if thumbnails else ""

def parse_duration_to_seconds(duration_str: Optional[str]) -> int:
    if not duration_str or not isinstance(duration_str, str):
        return 0
    parts = duration_str.strip().split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except Exception:
        pass
    return 0

def format_seconds_to_duration(seconds: int) -> str:
    m = seconds // 60
    s = seconds % 60
    return f"{m}:{s:02d}"

def extract_artists_str(artists_data: Any) -> str:
    if isinstance(artists_data, list):
        names = []
        for a in artists_data:
            if isinstance(a, dict) and "name" in a:
                names.append(a["name"])
            elif isinstance(a, str):
                names.append(a)
        return ", ".join(names)
    elif isinstance(artists_data, str):
        return artists_data
    return ""

def normalize_track(item: Dict[str, Any]) -> Dict[str, Any]:
    video_id = item.get("videoId") or item.get("id") or ""
    title = item.get("title") or "Unknown Title"
    
    # Artists
    artists_raw = item.get("artists") or []
    artist_name = extract_artists_str(artists_raw) or item.get("artist") or "Unknown Artist"
    
    # Album
    album_raw = item.get("album")
    album_title = ""
    album_id = None
    if isinstance(album_raw, dict):
        album_title = album_raw.get("name") or ""
        album_id = album_raw.get("id")
    elif isinstance(album_raw, str):
        album_title = album_raw

    # Duration
    duration = item.get("duration") or item.get("length") or ""
    duration_seconds = item.get("duration_seconds")
    if duration_seconds is None:
        duration_seconds = parse_duration_to_seconds(duration)
    if not duration and duration_seconds > 0:
        duration = format_seconds_to_duration(duration_seconds)

    # Thumbnail
    thumbnail = get_best_thumbnail(item.get("thumbnails")) or item.get("thumbnail") or ""
    if not thumbnail and video_id:
        thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    return {
        "videoId": video_id,
        "title": title,
        "artist": artist_name,
        "artists": artists_raw if isinstance(artists_raw, list) else [{"name": artist_name}],
        "album": album_title,
        "albumId": album_id,
        "duration": duration,
        "duration_seconds": duration_seconds,
        "thumbnail": thumbnail,
        "isExplicit": bool(item.get("isExplicit", False))
    }

# -------------------------------------------------------------
# EXCEPTION HANDLER
# -------------------------------------------------------------
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "success" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": str(exc.detail)}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log_error(f"Unhandled exception on {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error occurred. Please try again."}
    )

# -------------------------------------------------------------
# ROUTES: HEALTH / STATUS
# -------------------------------------------------------------
@app.get("/api/health")
def health_check():
    return {"success": True, "status": "online", "service": "Sonora Music API"}

# -------------------------------------------------------------
# ROUTES: HOME & TRENDING
# -------------------------------------------------------------
@app.get("/api/home")
def get_home():
    cache_key = "home_feed"
    cached = cache.get(cache_key)
    if cached:
        log_cache("Returning cached home feed")
        return {"success": True, "data": cached}

    log_info("Fetching home feed from YouTube Music")
    try:
        sections = []
        home_data = ytmusic.get_home(limit=8)
        
        for shelf in home_data:
            shelf_title = shelf.get("title", "Featured")
            raw_contents = shelf.get("contents", [])
            normalized_items = []
            
            for c in raw_contents:
                # Can be a song, album, playlist, or artist
                item_type = "song"
                video_id = c.get("videoId")
                browse_id = c.get("browseId")
                title = c.get("title", "")
                thumb = get_best_thumbnail(c.get("thumbnails"))
                
                if "playlistId" in c or (browse_id and browse_id.startswith("VL")):
                    item_type = "playlist"
                elif browse_id and (browse_id.startswith("MPRE") or "album" in c.get("type", "").lower()):
                    item_type = "album"
                elif browse_id and (browse_id.startswith("UC") or "artist" in c.get("type", "").lower()):
                    item_type = "artist"
                elif video_id:
                    item_type = "song"
                
                artists = c.get("artists")
                artist_name = extract_artists_str(artists) or ""
                
                item_dict = {
                    "type": item_type,
                    "title": title,
                    "thumbnail": thumb,
                    "artist": artist_name,
                    "videoId": video_id,
                    "browseId": browse_id,
                    "isExplicit": bool(c.get("isExplicit", False))
                }
                normalized_items.append(item_dict)

            if normalized_items:
                sections.append({
                    "title": shelf_title,
                    "items": normalized_items
                })

        # Also get quick trending charts
        try:
            charts = ytmusic.get_charts(country="US")
            video_charts = charts.get("videos", [])
            chart_songs = []
            if video_charts and isinstance(video_charts, list):
                pl_id = video_charts[0].get("playlistId")
                if pl_id:
                    pl = ytmusic.get_playlist(pl_id, limit=20)
                    chart_songs = [normalize_track(t) for t in pl.get("tracks", [])[:15]]
            if chart_songs:
                sections.insert(0, {
                    "title": "Top Charts & Trending",
                    "items": chart_songs
                })
        except Exception as e:
            log_error(f"Error getting charts for home: {e}")

        cache.set(cache_key, sections, ttl_seconds=600)
        return {"success": True, "data": sections}
    except Exception as e:
        log_error(f"Failed to fetch home feed: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "error": f"Failed to fetch home feed: {str(e)}"})

@app.get("/api/trending")
def get_trending():
    cache_key = "trending_charts"
    cached = cache.get(cache_key)
    if cached:
        log_cache("Returning cached trending charts")
        return {"success": True, "data": cached}

    log_info("Fetching trending charts")
    try:
        charts = ytmusic.get_charts(country="US")
        tracks = []
        video_charts = charts.get("videos", [])
        if video_charts and isinstance(video_charts, list):
            pl_id = video_charts[0].get("playlistId")
            if pl_id:
                pl = ytmusic.get_playlist(pl_id, limit=30)
                tracks = [normalize_track(t) for t in pl.get("tracks", [])]
        
        # Also top artists
        artists = []
        artists_list = charts.get("artists", [])
        if isinstance(artists_list, list):
            for a in artists_list[:25]:
                artists.append({
                    "artistId": a.get("browseId"),
                    "name": a.get("title"),
                    "subscribers": a.get("subscribers", ""),
                    "thumbnail": get_best_thumbnail(a.get("thumbnails")),
                    "rank": a.get("rank")
                })

        result = {
            "tracks": tracks,
            "artists": artists
        }
        cache.set(cache_key, result, ttl_seconds=600)
        return {"success": True, "data": result}
    except Exception as e:
        log_error(f"Failed to fetch trending: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "error": f"Failed to fetch trending: {str(e)}"})

# -------------------------------------------------------------
# ROUTES: SEARCH
# -------------------------------------------------------------
@app.get("/api/search")
def search_all(q: str = Query(..., min_length=1), filter: Optional[str] = Query(None)):
    q = sanitize_query(q)
    cache_key = f"search_{filter}_{q.lower()}"
    cached = cache.get(cache_key)
    if cached:
        log_cache(f"Returning cached search for '{q}' (filter={filter})")
        return {"success": True, "data": cached}

    log_search(f"Query='{q}', filter='{filter}'")
    try:
        if filter in ["songs", "artists", "albums", "videos"]:
            raw_results = ytmusic.search(q, filter=filter, limit=30)
        else:
            raw_results = ytmusic.search(q, limit=30)

        songs = []
        artists = []
        albums = []
        videos = []

        for item in raw_results:
            result_type = item.get("resultType") or item.get("type") or "song"
            
            if result_type == "song":
                songs.append(normalize_track(item))
            elif result_type == "artist":
                artists.append({
                    "artistId": item.get("browseId") or item.get("channelId"),
                    "name": item.get("artist") or item.get("name") or item.get("title"),
                    "subscribers": item.get("subscribers", ""),
                    "thumbnail": get_best_thumbnail(item.get("thumbnails"))
                })
            elif result_type == "album":
                albums.append({
                    "albumId": item.get("browseId"),
                    "title": item.get("title"),
                    "artist": extract_artists_str(item.get("artists")),
                    "year": item.get("year", ""),
                    "thumbnail": get_best_thumbnail(item.get("thumbnails")),
                    "isExplicit": bool(item.get("isExplicit", False))
                })
            elif result_type == "video":
                videos.append(normalize_track(item))

        result = {
            "query": q,
            "filter": filter,
            "songs": songs,
            "artists": artists,
            "albums": albums,
            "videos": videos
        }
        cache.set(cache_key, result, ttl_seconds=300)
        return {"success": True, "data": result}
    except Exception as e:
        log_error(f"Search failed for '{q}': {e}")
        raise HTTPException(status_code=500, detail={"success": False, "error": f"Search failed: {str(e)}"})

@app.get("/api/search/songs")
def search_songs(q: str = Query(..., min_length=1)):
    return search_all(q=q, filter="songs")

@app.get("/api/search/artists")
def search_artists(q: str = Query(..., min_length=1)):
    return search_all(q=q, filter="artists")

@app.get("/api/search/albums")
def search_albums(q: str = Query(..., min_length=1)):
    return search_all(q=q, filter="albums")

@app.get("/api/search/videos")
def search_videos(q: str = Query(..., min_length=1)):
    return search_all(q=q, filter="videos")

# -------------------------------------------------------------
# ROUTES: SONG DETAIL & RELATED
# -------------------------------------------------------------
@app.get("/api/song/{video_id}")
def get_song_detail(video_id: str):
    video_id = sanitize_id(video_id)
    cache_key = f"song_{video_id}"
    cached = cache.get(cache_key)
    if cached:
        log_cache(f"Returning cached song details for {video_id}")
        return {"success": True, "data": cached}

    log_info(f"Fetching song details for {video_id}")
    try:
        watch = ytmusic.get_watch_playlist(videoId=video_id, limit=20)
        tracks = watch.get("tracks", [])
        
        target_track = None
        related_tracks = []
        for t in tracks:
            norm = normalize_track(t)
            if t.get("videoId") == video_id and not target_track:
                target_track = norm
            else:
                related_tracks.append(norm)

        if not target_track and tracks:
            target_track = normalize_track(tracks[0])
            target_track["videoId"] = video_id
        elif not target_track:
            target_track = {
                "videoId": video_id,
                "title": "Playing Track",
                "artist": "YouTube Music",
                "artists": [{"name": "YouTube Music"}],
                "album": "",
                "duration": "0:00",
                "duration_seconds": 0,
                "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "isExplicit": False
            }

        result = {
            "song": target_track,
            "lyricsId": watch.get("lyrics"),
            "related": related_tracks[:15]
        }
        cache.set(cache_key, result, ttl_seconds=600)
        return {"success": True, "data": result}
    except Exception as e:
        log_error(f"Failed to fetch song details for {video_id}: {e}")
        # Graceful fallback
        fallback = {
            "song": {
                "videoId": video_id,
                "title": "Track",
                "artist": "Artist",
                "artists": [{"name": "Artist"}],
                "album": "",
                "duration": "0:00",
                "duration_seconds": 0,
                "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "isExplicit": False
            },
            "lyricsId": None,
            "related": []
        }
        return {"success": True, "data": fallback}

@app.get("/api/related/{video_id}")
def get_related_songs(video_id: str):
    video_id = sanitize_id(video_id)
    cache_key = f"related_{video_id}"
    cached = cache.get(cache_key)
    if cached:
        return {"success": True, "data": cached}

    log_info(f"Fetching related songs for {video_id}")
    try:
        watch = ytmusic.get_watch_playlist(videoId=video_id, limit=25)
        tracks = watch.get("tracks", [])
        related = [normalize_track(t) for t in tracks if t.get("videoId") != video_id]
        cache.set(cache_key, related, ttl_seconds=600)
        return {"success": True, "data": related}
    except Exception as e:
        log_error(f"Failed to fetch related songs for {video_id}: {e}")
        return {"success": True, "data": []}

# -------------------------------------------------------------
# ROUTES: ARTIST DETAIL, SONGS, ALBUMS
# -------------------------------------------------------------
@app.get("/api/artist/{artist_id}")
def get_artist_detail(artist_id: str):
    artist_id = sanitize_id(artist_id)
    cache_key = f"artist_{artist_id}"
    cached = cache.get(cache_key)
    if cached:
        log_cache(f"Returning cached artist details for {artist_id}")
        return {"success": True, "data": cached}

    log_info(f"Fetching artist profile: {artist_id}")
    try:
        artist_data = ytmusic.get_artist(artist_id)
        
        name = artist_data.get("name", "Unknown Artist")
        description = artist_data.get("description", "")
        thumbnails = artist_data.get("thumbnails", [])
        header_image = get_best_thumbnail(thumbnails)
        subscribers = artist_data.get("subscribers", "")
        views = artist_data.get("views", "")

        # Top Songs
        songs_data = artist_data.get("songs", {})
        top_songs_raw = songs_data.get("results", [])
        top_songs = [normalize_track(t) for t in top_songs_raw]
        songs_browse_id = songs_data.get("browseId")

        # Albums
        albums_raw = artist_data.get("albums", {}).get("results", [])
        albums = []
        for alb in albums_raw:
            albums.append({
                "albumId": alb.get("browseId"),
                "title": alb.get("title"),
                "year": alb.get("year", ""),
                "thumbnail": get_best_thumbnail(alb.get("thumbnails")),
                "isExplicit": bool(alb.get("isExplicit", False))
            })

        # Singles & EPs
        singles_raw = artist_data.get("singles", {}).get("results", [])
        singles = []
        for s in singles_raw:
            singles.append({
                "albumId": s.get("browseId"),
                "title": s.get("title"),
                "year": s.get("year", ""),
                "thumbnail": get_best_thumbnail(s.get("thumbnails")),
                "isExplicit": bool(s.get("isExplicit", False))
            })

        # Related Artists
        related_raw = artist_data.get("related", {}).get("results", [])
        related_artists = []
        for r in related_raw:
            related_artists.append({
                "artistId": r.get("browseId"),
                "name": r.get("title"),
                "subscribers": r.get("subscribers", ""),
                "thumbnail": get_best_thumbnail(r.get("thumbnails"))
            })

        result = {
            "artistId": artist_id,
            "name": name,
            "description": description,
            "thumbnail": header_image,
            "subscribers": subscribers,
            "views": views,
            "topSongs": top_songs,
            "songsBrowseId": songs_browse_id,
            "albums": albums,
            "singles": singles,
            "related": related_artists
        }
        cache.set(cache_key, result, ttl_seconds=600)
        return {"success": True, "data": result}
    except Exception as e:
        log_error(f"Failed to fetch artist {artist_id}: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "error": f"Failed to fetch artist details: {str(e)}"})

@app.get("/api/artist/{artist_id}/songs")
def get_artist_songs(artist_id: str):
    artist_id = sanitize_id(artist_id)
    cache_key = f"artist_songs_{artist_id}"
    cached = cache.get(cache_key)
    if cached:
        return {"success": True, "data": cached}

    log_info(f"Fetching full artist songs for {artist_id}")
    try:
        artist_data = ytmusic.get_artist(artist_id)
        songs_browse_id = artist_data.get("songs", {}).get("browseId")
        if songs_browse_id:
            playlist = ytmusic.get_playlist(songs_browse_id, limit=100)
            tracks = [normalize_track(t) for t in playlist.get("tracks", [])]
        else:
            tracks = [normalize_track(t) for t in artist_data.get("songs", {}).get("results", [])]
        
        cache.set(cache_key, tracks, ttl_seconds=600)
        return {"success": True, "data": tracks}
    except Exception as e:
        log_error(f"Failed to fetch artist songs for {artist_id}: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "error": f"Failed to fetch artist songs: {str(e)}"})

@app.get("/api/artist/{artist_id}/albums")
def get_artist_albums(artist_id: str):
    artist_id = sanitize_id(artist_id)
    cache_key = f"artist_albums_{artist_id}"
    cached = cache.get(cache_key)
    if cached:
        return {"success": True, "data": cached}

    log_info(f"Fetching albums for artist {artist_id}")
    try:
        artist_data = ytmusic.get_artist(artist_id)
        albums_raw = artist_data.get("albums", {}).get("results", [])
        albums = []
        for alb in albums_raw:
            albums.append({
                "albumId": alb.get("browseId"),
                "title": alb.get("title"),
                "year": alb.get("year", ""),
                "thumbnail": get_best_thumbnail(alb.get("thumbnails")),
                "isExplicit": bool(alb.get("isExplicit", False))
            })
        cache.set(cache_key, albums, ttl_seconds=600)
        return {"success": True, "data": albums}
    except Exception as e:
        log_error(f"Failed to fetch artist albums for {artist_id}: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "error": f"Failed to fetch artist albums: {str(e)}"})

# -------------------------------------------------------------
# ROUTES: ALBUM DETAIL
# -------------------------------------------------------------
@app.get("/api/album/{album_id}")
def get_album_detail(album_id: str):
    album_id = sanitize_id(album_id)
    cache_key = f"album_{album_id}"
    cached = cache.get(cache_key)
    if cached:
        log_cache(f"Returning cached album details for {album_id}")
        return {"success": True, "data": cached}

    log_info(f"Fetching album details: {album_id}")
    try:
        album_data = ytmusic.get_album(album_id)
        
        title = album_data.get("title", "Unknown Album")
        artist = extract_artists_str(album_data.get("artists"))
        year = album_data.get("year", "")
        description = album_data.get("description", "")
        thumbnail = get_best_thumbnail(album_data.get("thumbnails"))
        track_count = album_data.get("trackCount") or len(album_data.get("tracks", []))
        duration = album_data.get("duration", "")

        tracks = []
        for idx, t in enumerate(album_data.get("tracks", [])):
            norm = normalize_track(t)
            norm["trackNumber"] = idx + 1
            if not norm["thumbnail"]:
                norm["thumbnail"] = thumbnail
            if not norm["album"]:
                norm["album"] = title
            if not norm["albumId"]:
                norm["albumId"] = album_id
            tracks.append(norm)

        result = {
            "albumId": album_id,
            "title": title,
            "artist": artist,
            "artists": album_data.get("artists", []),
            "year": year,
            "description": description,
            "thumbnail": thumbnail,
            "trackCount": track_count,
            "duration": duration,
            "tracks": tracks
        }
        cache.set(cache_key, result, ttl_seconds=600)
        return {"success": True, "data": result}
    except Exception as e:
        log_error(f"Failed to fetch album {album_id}: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "error": f"Failed to fetch album details: {str(e)}"})

# -------------------------------------------------------------
# ROUTES: LYRICS
# -------------------------------------------------------------
def parse_lrc_timestamps(lrc_text: str) -> List[Dict[str, Any]]:
    lines = []
    regex = re.compile(r"\[(\d{2}):(\d{2})\.?(\d{2,3})?\](.*)")
    for raw_line in lrc_text.splitlines():
        match = regex.match(raw_line.strip())
        if match:
            min_str, sec_str, ms_str, text = match.groups()
            minutes = int(min_str)
            seconds = int(sec_str)
            ms = int(ms_str[:2]) if ms_str else 0
            timestamp = minutes * 60 + seconds + (ms / 100.0)
            cleaned_text = text.strip()
            if cleaned_text:
                lines.append({"time": round(timestamp, 2), "text": cleaned_text})
    return lines

@app.get("/api/song/{video_id}/lyrics")
async def get_lyrics(video_id: str, title: Optional[str] = None, artist: Optional[str] = None):
    video_id = sanitize_id(video_id)
    cache_key = f"lyrics_{video_id}"
    cached = cache.get(cache_key)
    if cached:
        log_cache(f"Returning cached lyrics for {video_id}")
        return {"success": True, "data": cached}

    log_lyrics(f"Resolving lyrics for video {video_id} (title={title}, artist={artist})")
    
    # 1. Try to get title & artist from YouTube Music if not provided
    song_title = title
    song_artist = artist
    lyrics_browse_id = None

    try:
        watch = ytmusic.get_watch_playlist(videoId=video_id, limit=5)
        lyrics_browse_id = watch.get("lyrics")
        if not song_title and watch.get("tracks"):
            t = watch["tracks"][0]
            song_title = t.get("title")
            song_artist = extract_artists_str(t.get("artists"))
    except Exception as e:
        log_error(f"Error fetching watch playlist for lyrics info: {e}")

    # Clean title for LRCLIB search (strip "(Official Music Video)", "ft.", etc.)
    cleaned_title = song_title
    if cleaned_title:
        cleaned_title = re.sub(r"\(.*?\)|\[.*?\]", "", cleaned_title).strip()
        cleaned_title = re.sub(r"ft\..*|feat\..*", "", cleaned_title, flags=re.IGNORECASE).strip()

    # Priority 1: Check LRCLIB for synced lyrics (public legal API)
    if cleaned_title and song_artist:
        try:
            log_lyrics(f"Checking LRCLIB for '{cleaned_title}' by '{song_artist}'")
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(
                    "https://lrclib.net/api/get",
                    params={"track_name": cleaned_title, "artist_name": song_artist}
                )
                if res.status_code == 200:
                    lrclib_data = res.json()
                    synced_raw = lrclib_data.get("syncedLyrics")
                    plain_lyrics = lrclib_data.get("plainLyrics")
                    
                    if synced_raw:
                        synced_lines = parse_lrc_timestamps(synced_raw)
                        if synced_lines:
                            result = {
                                "hasSynced": True,
                                "synced": synced_lines,
                                "plain": plain_lyrics or "\n".join([line["text"] for line in synced_lines]),
                                "source": "LRCLIB Synced"
                            }
                            cache.set(cache_key, result, ttl_seconds=3600)
                            return {"success": True, "data": result}
                    
                    if plain_lyrics:
                        result = {
                            "hasSynced": False,
                            "synced": None,
                            "plain": plain_lyrics,
                            "source": "LRCLIB Plain"
                        }
                        cache.set(cache_key, result, ttl_seconds=3600)
                        return {"success": True, "data": result}
        except Exception as e:
            log_lyrics(f"LRCLIB request failed: {e}")

    # Priority 2: Check YouTube Music lyrics
    if lyrics_browse_id:
        try:
            log_lyrics(f"Fetching official YouTube Music lyrics browseId={lyrics_browse_id}")
            yt_lyrics = ytmusic.get_lyrics(browseId=lyrics_browse_id)
            lyrics_text = yt_lyrics.get("lyrics", "")
            if lyrics_text and lyrics_text.strip():
                result = {
                    "hasSynced": False,
                    "synced": None,
                    "plain": lyrics_text,
                    "source": yt_lyrics.get("source", "YouTube Music")
                }
                cache.set(cache_key, result, ttl_seconds=3600)
                return {"success": True, "data": result}
        except Exception as e:
            log_lyrics(f"YouTube Music lyrics fetch failed: {e}")

    # If lyrics unavailable:
    unavailable_result = {
        "hasSynced": False,
        "synced": None,
        "plain": None,
        "source": None,
        "message": "Lyrics unavailable"
    }
    cache.set(cache_key, unavailable_result, ttl_seconds=1800)
    return {"success": True, "data": unavailable_result}

# -------------------------------------------------------------
# ROUTES: AUDIO STREAM (yt-dlp with caching and proxy/redirect)
# -------------------------------------------------------------
@app.get("/api/song/{video_id}/stream")
async def get_audio_stream(video_id: str, request: Request):
    video_id = sanitize_id(video_id)
    cache_key = f"stream_url_{video_id}"
    cached_url = cache.get(cache_key)

    if cached_url:
        log_cache(f"Using cached stream URL for {video_id}")
        return RedirectResponse(url=cached_url, status_code=307)

    log_stream(f"Resolving audio stream for {video_id}")

    # 1. Try yt-dlp first
    direct_url = None
    ydl_opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "socket_timeout": 8,
    }

    try:
        log_ytdlp(f"Extracting info with yt-dlp for {video_id}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            direct_url = info.get("url")
            if not direct_url:
                formats = info.get("formats", [])
                audio_formats = [f for f in formats if f.get("vcodec") == "none" and f.get("acodec") != "none"]
                if audio_formats:
                    direct_url = audio_formats[-1].get("url")
    except Exception as ytdlp_err:
        log_ytdlp(f"yt-dlp extraction note: {ytdlp_err}")

    if direct_url:
        log_stream(f"Successfully extracted direct stream URL for {video_id}")
        cache.set(cache_key, direct_url, ttl_seconds=1800)
        return RedirectResponse(url=direct_url, status_code=307)

    # 2. Try Invidious / Piped public instance proxy if yt-dlp was bot-flagged on cloud IP
    invidious_endpoints = [
        "https://invidious.f5.si",
        "https://inv.nadeko.net",
        "https://invidious.nerdvpn.de",
    ]

    for inv in invidious_endpoints:
        try:
            log_stream(f"Attempting public stream extraction via {inv} for {video_id}")
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(f"{inv}/api/v1/videos/{video_id}")
                if res.status_code == 200:
                    vdata = res.json()
                    formats = vdata.get("adaptiveFormats") or []
                    audio_formats = [f for f in formats if "audio" in f.get("type", "")]
                    if audio_formats:
                        found_url = audio_formats[0].get("url")
                        if found_url:
                            # Stream via public latest_version proxy or direct
                            proxy_url = f"{inv}/latest_version?id={video_id}&itag=140"
                            log_stream(f"Found audio stream via {inv}")
                            cache.set(cache_key, proxy_url, ttl_seconds=1800)
                            return RedirectResponse(url=proxy_url, status_code=307)
        except Exception as e:
            log_stream(f"Fallback {inv} error: {e}")

    # If stream could not be extracted directly on server due to YouTube bot restriction,
    # return structured JSON so frontend can fall back to the integrated player engine.
    log_stream(f"Direct stream URL could not be retrieved from server IP for {video_id}")
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "error": "Direct audio stream unavailable on current server network. Player engine will use client-side streaming.",
            "videoId": video_id
        }
    )
