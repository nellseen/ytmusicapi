import os
import re
import time
import random
import logging
import asyncio
import threading
from typing import Optional, List, Dict, Any, Tuple
from fastapi import FastAPI, HTTPException, Query, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
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
logger = logging.getLogger("nellspotif")

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

def log_network(msg: str):
    logger.info(f"[NETWORK] {msg}")

def log_retry(msg: str):
    logger.info(f"[RETRY] {msg}")

def log_health(msg: str):
    logger.info(f"[HEALTH] {msg}")

def log_queue(msg: str):
    logger.info(f"[QUEUE] {msg}")

def log_ytmusic(msg: str):
    logger.info(f"[YT-MUSIC] {msg}")

# -------------------------------------------------------------
# CONTROLLED UPSTREAM EXCEPTIONS
# -------------------------------------------------------------
class UpstreamDNSError(Exception):
    def __init__(self, message: str = "Unable to resolve YouTube Music"):
        super().__init__(message)
        self.message = message
        self.code = "UPSTREAM_DNS_ERROR"
        self.retryable = True
        self.status_code = 503

class UpstreamRateLimitError(Exception):
    def __init__(self, message: str = "YouTube Music rate limit reached"):
        super().__init__(message)
        self.message = message
        self.code = "UPSTREAM_RATE_LIMIT"
        self.retryable = True
        self.status_code = 429

class UpstreamUnavailableError(Exception):
    def __init__(self, message: str = "YouTube Music is temporarily unavailable"):
        super().__init__(message)
        self.message = message
        self.code = "UPSTREAM_UNAVAILABLE"
        self.retryable = True
        self.status_code = 503

class InvalidRequestError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message
        self.code = "INVALID_REQUEST"
        self.retryable = False
        self.status_code = 400

# -------------------------------------------------------------
# APP INITIALIZATION & CORS
# -------------------------------------------------------------
app = FastAPI(title="NellSpotif Music API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
# THREAD-SAFE TTL CACHE IMPLEMENTATION
# -------------------------------------------------------------
class TTLMemoryCache:
    def __init__(self, max_entries: int = 1000):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._max_entries = max_entries

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            if item["expires_at"] > time.time():
                return item["value"]
            else:
                del self._store[key]
                return None

    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        with self._lock:
            now = time.time()
            if len(self._store) >= self._max_entries:
                # Evict expired items
                expired = [k for k, v in self._store.items() if v["expires_at"] <= now]
                for k in expired:
                    del self._store[k]
                # If still full, evict oldest 20%
                if len(self._store) >= self._max_entries:
                    sorted_keys = sorted(self._store.keys(), key=lambda k: self._store[k]["expires_at"])
                    for k in sorted_keys[: max(1, len(sorted_keys) // 5)]:
                        del self._store[k]

            self._store[key] = {
                "value": value,
                "expires_at": now + ttl_seconds
            }

    def delete(self, key: str):
        with self._lock:
            if key in self._store:
                del self._store[key]

    def clear(self):
        with self._lock:
            self._store.clear()

cache = TTLMemoryCache(max_entries=1000)

# TTL Constants (seconds)
TTL_HOME = 600      # 10 minutes
TTL_TRENDING = 600  # 10 minutes
TTL_SEARCH = 180    # 3 minutes
TTL_SONG = 900      # 15 minutes
TTL_ARTIST = 900    # 15 minutes
TTL_ALBUM = 900     # 15 minutes
TTL_LYRICS = 3600   # 1 hour
TTL_STREAM = 600    # 10 minutes

# Concurrency Semaphores (Termux safe)
YTMUSIC_SEMAPHORE = asyncio.Semaphore(4)
STREAM_SEMAPHORE = asyncio.Semaphore(2)

# -------------------------------------------------------------
# NETWORK & RETRY LAYER FOR YTMUSIC
# -------------------------------------------------------------
def classify_error(err: Exception) -> Tuple[str, bool]:
    """
    Returns (error_type, is_transient)
    error_types: 'dns', 'rate_limit', 'timeout', 'connection', 'invalid', 'other'
    """
    msg = str(err).lower()

    if any(k in msg for k in [
        "nameresolutionerror",
        "temporary failure in name resolution",
        "errno -3",
        "gaierror",
        "failed to resolve",
        "nodename nor servname provided"
    ]):
        return "dns", True

    if "429" in msg or "too many requests" in msg:
        return "rate_limit", True

    if any(k in msg for k in ["connecttimeout", "readtimeout", "timed out", "timeout"]):
        return "timeout", True

    if any(k in msg for k in ["connectionreset", "remotedisconnected", "connection error", "connection refused", "502", "503", "504"]):
        return "connection", True

    if any(k in msg for k in ["not found", "404", "invalid video", "unknown browseid", "400"]):
        return "invalid", False

    return "other", True

async def safe_ytmusic_call(func_name: str, func, *args, **kwargs) -> Any:
    """
    Executes a ytmusicapi blocking function within asyncio.to_thread,
    guarded by concurrency semaphore and retry with exponential backoff for transient errors.
    """
    if ytmusic is None:
        raise UpstreamUnavailableError("YouTube Music client not initialized")

    max_retries = 3
    attempt = 0

    log_ytmusic(f"Request started: {func_name}")

    async with YTMUSIC_SEMAPHORE:
        while attempt < max_retries:
            try:
                # Execute blocking synchronous call safely in worker thread
                result = await asyncio.to_thread(func, *args, **kwargs)
                return result
            except Exception as e:
                err_type, is_transient = classify_error(e)
                attempt += 1

                if not is_transient:
                    log_error(f"[YT-MUSIC] Non-transient error in {func_name}: {e}")
                    raise InvalidRequestError(f"Request failed: {str(e)}")

                if err_type == "dns":
                    log_network(f"DNS failure resolving music.youtube.com: {e}")
                elif err_type == "rate_limit":
                    log_network(f"Rate limit encountered on YouTube Music: {e}")
                else:
                    log_network(f"{err_type.capitalize()} error during {func_name}: {e}")

                if attempt >= max_retries:
                    log_ytmusic(f"Upstream unavailable after {max_retries} attempts for {func_name}")
                    if err_type == "dns":
                        raise UpstreamDNSError("Unable to resolve YouTube Music")
                    elif err_type == "rate_limit":
                        raise UpstreamRateLimitError("YouTube Music rate limit reached")
                    else:
                        raise UpstreamUnavailableError("YouTube Music is temporarily unavailable")

                # Exponential backoff with jitter
                delay = (0.7 * (2 ** (attempt - 1))) + random.uniform(0.1, 0.3)
                log_retry(f"ytmusic request retry {attempt}/{max_retries} in {delay:.1f}s")
                await asyncio.sleep(delay)

# -------------------------------------------------------------
# SANITIZATION HELPERS
# -------------------------------------------------------------
ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.]{1,128}$")

def sanitize_id(identifier: str) -> str:
    identifier = identifier.strip()
    if not ID_REGEX.match(identifier):
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": f"Invalid identifier format: '{identifier}'",
                "code": "INVALID_REQUEST",
                "retryable": False
            }
        )
    return identifier

def sanitize_query(query: str) -> str:
    cleaned = query.strip()
    if not cleaned or len(cleaned) > 200:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Query must be between 1 and 200 characters",
                "code": "INVALID_REQUEST",
                "retryable": False
            }
        )
    return cleaned

# -------------------------------------------------------------
# METADATA NORMALIZATION (NO FAKE / DUMMY METADATA)
# -------------------------------------------------------------
def get_best_thumbnail(thumbnails: Optional[List[Dict[str, Any]]]) -> str:
    if not thumbnails or not isinstance(thumbnails, list):
        return ""
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
    """
    Normalizes track data from ytmusicapi. Strictly preserves real metadata.
    Never invents fake titles, fake artists, or dummy durations.
    """
    video_id = item.get("videoId") or item.get("id") or ""
    title = item.get("title") or ""
    
    artists_raw = item.get("artists") or []
    artist_name = extract_artists_str(artists_raw) or item.get("artist") or ""
    
    album_raw = item.get("album")
    album_title = ""
    album_id = None
    if isinstance(album_raw, dict):
        album_title = album_raw.get("name") or ""
        album_id = album_raw.get("id")
    elif isinstance(album_raw, str):
        album_title = album_raw

    duration = item.get("duration") or item.get("length") or ""
    duration_seconds = item.get("duration_seconds")
    if duration_seconds is None:
        duration_seconds = parse_duration_to_seconds(duration)
    if not duration and duration_seconds > 0:
        duration = format_seconds_to_duration(duration_seconds)

    thumbnail = get_best_thumbnail(item.get("thumbnails")) or item.get("thumbnail") or ""
    if not thumbnail and video_id:
        thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    return {
        "videoId": video_id,
        "title": title,
        "artist": artist_name,
        "artists": artists_raw if isinstance(artists_raw, list) else ([{"name": artist_name}] if artist_name else []),
        "album": album_title,
        "albumId": album_id,
        "duration": duration,
        "duration_seconds": duration_seconds,
        "thumbnail": thumbnail,
        "isExplicit": bool(item.get("isExplicit", False))
    }

# -------------------------------------------------------------
# CONTROLLED EXCEPTION HANDLERS
# -------------------------------------------------------------
@app.exception_handler(UpstreamDNSError)
async def upstream_dns_handler(request: Request, exc: UpstreamDNSError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.message,
            "code": exc.code,
            "retryable": exc.retryable
        }
    )

@app.exception_handler(UpstreamRateLimitError)
async def upstream_rate_limit_handler(request: Request, exc: UpstreamRateLimitError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.message,
            "code": exc.code,
            "retryable": exc.retryable
        }
    )

@app.exception_handler(UpstreamUnavailableError)
async def upstream_unavailable_handler(request: Request, exc: UpstreamUnavailableError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.message,
            "code": exc.code,
            "retryable": exc.retryable
        }
    )

@app.exception_handler(InvalidRequestError)
async def invalid_request_handler(request: Request, exc: InvalidRequestError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.message,
            "code": exc.code,
            "retryable": exc.retryable
        }
    )

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "success" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": str(exc.detail),
            "code": "HTTP_ERROR",
            "retryable": exc.status_code >= 500
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log_error(f"Unhandled exception on {request.url.path}: {str(exc)}")
    err_type, is_transient = classify_error(exc)
    code = "UPSTREAM_DNS_ERROR" if err_type == "dns" else ("UPSTREAM_RATE_LIMIT" if err_type == "rate_limit" else "INTERNAL_ERROR")
    return JSONResponse(
        status_code=503 if is_transient else 500,
        content={
            "success": False,
            "error": "YouTube Music is temporarily unavailable" if is_transient else "An internal error occurred",
            "code": code,
            "retryable": is_transient
        }
    )

# -------------------------------------------------------------
# ROUTES: HEALTH / STATUS (UPSTREAM DIAGNOSTIC)
# -------------------------------------------------------------
async def check_upstream_health() -> Dict[str, Any]:
    cached = cache.get("health_upstream")
    if cached:
        return cached

    try:
        # Lightweight quick test: resolve music.youtube.com or search a test token
        def test_ping():
            import socket
            socket.gethostbyname("music.youtube.com")
            return True

        await asyncio.wait_for(asyncio.to_thread(test_ping), timeout=2.5)
        status_data = {"status": "online"}
        cache.set("health_upstream", status_data, ttl_seconds=30)
        return status_data
    except Exception as e:
        err_type, _ = classify_error(e)
        err_msg = "DNS resolution failed" if err_type == "dns" else ("Connection timed out" if err_type == "timeout" else str(e))
        log_health(f"YouTube Music status: degraded ({err_msg})")
        status_data = {
            "status": "degraded",
            "error": err_msg
        }
        cache.set("health_upstream", status_data, ttl_seconds=15)
        return status_data

@app.get("/api/health")
async def health_check():
    yt_health = await check_upstream_health()
    return {
        "success": True,
        "backend": "online",
        "service": "NellSpotif Music API",
        "ytmusic": yt_health
    }

# -------------------------------------------------------------
# ROUTES: HOME & TRENDING
# -------------------------------------------------------------
@app.get("/api/home")
async def get_home():
    cache_key = "home_feed"
    cached = cache.get(cache_key)
    if cached:
        log_cache("Returning cached home feed")
        return {"success": True, "data": cached}

    log_info("Fetching home feed from YouTube Music")
    sections = []

    # 1. Fetch home shelves
    try:
        home_data = await safe_ytmusic_call("get_home", ytmusic.get_home, limit=8)
        if isinstance(home_data, list):
            for shelf in home_data:
                shelf_title = shelf.get("title", "Featured")
                raw_contents = shelf.get("contents", [])
                normalized_items = []
                
                for c in raw_contents:
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
    except Exception as e:
        log_error(f"Home shelves fetch error: {e}")
        # Non-all-or-nothing: do not abort if charts still can be attempted

    # 2. Fetch top charts & trending shelf
    try:
        charts = await safe_ytmusic_call("get_charts", ytmusic.get_charts, country="US")
        video_charts = charts.get("videos", [])
        if video_charts and isinstance(video_charts, list):
            pl_id = video_charts[0].get("playlistId")
            if pl_id:
                pl = await safe_ytmusic_call("get_playlist", ytmusic.get_playlist, pl_id, limit=20)
                chart_songs = [normalize_track(t) for t in pl.get("tracks", [])[:15] if t.get("title")]
                if chart_songs:
                    sections.insert(0, {
                        "title": "Top Charts & Trending",
                        "items": chart_songs
                    })
    except Exception as e:
        log_error(f"Charts fetch for home error: {e}")

    if not sections:
        raise UpstreamUnavailableError("Unable to fetch any sections from YouTube Music")

    cache.set(cache_key, sections, ttl_seconds=TTL_HOME)
    return {"success": True, "data": sections}

@app.get("/api/trending")
async def get_trending():
    cache_key = "trending_charts"
    cached = cache.get(cache_key)
    if cached:
        log_cache("Returning cached trending charts")
        return {"success": True, "data": cached}

    log_info("Fetching trending charts")
    charts = await safe_ytmusic_call("get_charts", ytmusic.get_charts, country="US")
    
    tracks = []
    video_charts = charts.get("videos", [])
    if video_charts and isinstance(video_charts, list):
        pl_id = video_charts[0].get("playlistId")
        if pl_id:
            try:
                pl = await safe_ytmusic_call("get_playlist", ytmusic.get_playlist, pl_id, limit=30)
                tracks = [normalize_track(t) for t in pl.get("tracks", []) if t.get("title")]
            except Exception as e:
                log_error(f"Error fetching trending playlist: {e}")

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
    cache.set(cache_key, result, ttl_seconds=TTL_TRENDING)
    return {"success": True, "data": result}

# -------------------------------------------------------------
# ROUTES: SEARCH
# -------------------------------------------------------------
@app.get("/api/search")
async def search_all(q: str = Query(..., min_length=1), filter: Optional[str] = Query(None)):
    q = sanitize_query(q)
    cache_key = f"search_{filter}_{q.lower()}"
    cached = cache.get(cache_key)
    if cached:
        log_cache(f"Returning cached search for '{q}' (filter={filter})")
        return {"success": True, "data": cached}

    log_search(f"Query='{q}', filter='{filter}'")
    if filter in ["songs", "artists", "albums", "videos"]:
        raw_results = await safe_ytmusic_call("search", ytmusic.search, q, filter=filter, limit=30)
    else:
        raw_results = await safe_ytmusic_call("search", ytmusic.search, q, limit=30)

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
    cache.set(cache_key, result, ttl_seconds=TTL_SEARCH)
    return {"success": True, "data": result}

@app.get("/api/search/songs")
async def search_songs(q: str = Query(..., min_length=1)):
    return await search_all(q=q, filter="songs")

@app.get("/api/search/artists")
async def search_artists(q: str = Query(..., min_length=1)):
    return await search_all(q=q, filter="artists")

@app.get("/api/search/albums")
async def search_albums(q: str = Query(..., min_length=1)):
    return await search_all(q=q, filter="albums")

@app.get("/api/search/videos")
async def search_videos(q: str = Query(..., min_length=1)):
    return await search_all(q=q, filter="videos")

# -------------------------------------------------------------
# ROUTES: SONG DETAIL & RELATED (NO FAKE DATA)
# -------------------------------------------------------------
@app.get("/api/song/{video_id}")
async def get_song_detail(video_id: str):
    video_id = sanitize_id(video_id)
    cache_key = f"song_{video_id}"
    cached = cache.get(cache_key)
    if cached:
        log_cache(f"Returning cached song details for {video_id}")
        return {"success": True, "data": cached}

    log_info(f"Fetching song details for {video_id}")
    watch = await safe_ytmusic_call("get_watch_playlist", ytmusic.get_watch_playlist, videoId=video_id, limit=20)
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

    # Strictly do NOT fake data: if no track could be retrieved, return 404
    if not target_track:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "error": f"Song with ID {video_id} not found on YouTube Music",
                "code": "NOT_FOUND",
                "retryable": False
            }
        )

    result = {
        "song": target_track,
        "lyricsId": watch.get("lyrics"),
        "related": related_tracks[:15]
    }
    cache.set(cache_key, result, ttl_seconds=TTL_SONG)
    return {"success": True, "data": result}

@app.get("/api/related/{video_id}")
async def get_related_songs(video_id: str):
    video_id = sanitize_id(video_id)
    cache_key = f"related_{video_id}"
    cached = cache.get(cache_key)
    if cached:
        return {"success": True, "data": cached}

    log_info(f"Fetching related songs for {video_id}")
    watch = await safe_ytmusic_call("get_watch_playlist", ytmusic.get_watch_playlist, videoId=video_id, limit=25)
    tracks = watch.get("tracks", [])
    related = [normalize_track(t) for t in tracks if t.get("videoId") != video_id and t.get("title")]
    cache.set(cache_key, related, ttl_seconds=TTL_SONG)
    return {"success": True, "data": related}

# -------------------------------------------------------------
# ROUTES: ARTIST DETAIL, SONGS (NO HARD LIMIT), ALBUMS
# -------------------------------------------------------------
@app.get("/api/artist/{artist_id}")
async def get_artist_detail(artist_id: str):
    artist_id = sanitize_id(artist_id)
    cache_key = f"artist_{artist_id}"
    cached = cache.get(cache_key)
    if cached:
        log_cache(f"Returning cached artist details for {artist_id}")
        return {"success": True, "data": cached}

    log_info(f"Fetching artist profile: {artist_id}")
    artist_data = await safe_ytmusic_call("get_artist", ytmusic.get_artist, artist_id)
    
    name = artist_data.get("name") or "Artist"
    description = artist_data.get("description", "")
    thumbnails = artist_data.get("thumbnails", [])
    header_image = get_best_thumbnail(thumbnails)
    subscribers = artist_data.get("subscribers", "")
    views = artist_data.get("views", "")

    # Top Songs
    songs_data = artist_data.get("songs", {})
    top_songs_raw = songs_data.get("results", [])
    top_songs = [normalize_track(t) for t in top_songs_raw if t.get("title")]
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
    cache.set(cache_key, result, ttl_seconds=TTL_ARTIST)
    return {"success": True, "data": result}

@app.get("/api/artist/{artist_id}/songs")
async def get_artist_songs(
    artist_id: str,
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=100)
):
    """
    Fetches ALL available songs for the artist using continuation (limit=None),
    deduplicated by videoId. Supports optional pagination parameters.
    """
    artist_id = sanitize_id(artist_id)
    cache_key = f"artist_songs_all_{artist_id}"
    all_tracks = cache.get(cache_key)

    if not all_tracks:
        log_info(f"Fetching full artist songs catalogue for {artist_id} with continuation...")
        artist_data = await safe_ytmusic_call("get_artist", ytmusic.get_artist, artist_id)
        songs_browse_id = artist_data.get("songs", {}).get("browseId")

        raw_tracks = []
        if songs_browse_id:
            # limit=None tells ytmusicapi to follow continuations until exhausted!
            try:
                playlist = await safe_ytmusic_call("get_playlist", ytmusic.get_playlist, songs_browse_id, limit=None)
                raw_tracks = playlist.get("tracks", [])
            except Exception as e:
                log_error(f"Continuation playlist fetch error: {e}")
                raw_tracks = artist_data.get("songs", {}).get("results", [])
        else:
            raw_tracks = artist_data.get("songs", {}).get("results", [])

        # Deduplicate tracks by videoId while preserving order
        deduped = []
        seen_ids = set()
        for t in raw_tracks:
            vid = t.get("videoId")
            if vid and vid not in seen_ids and t.get("title"):
                seen_ids.add(vid)
                deduped.append(normalize_track(t))
            elif not vid and t.get("title"):
                deduped.append(normalize_track(t))

        all_tracks = deduped
        log_info(f"Retrieved {len(all_tracks)} total deduplicated tracks for artist {artist_id}")
        cache.set(cache_key, all_tracks, ttl_seconds=TTL_ARTIST)

    # If pagination requested
    if page is not None and limit is not None:
        start = (page - 1) * limit
        end = start + limit
        paginated = all_tracks[start:end]
        return {
            "success": True,
            "data": {
                "tracks": paginated,
                "total": len(all_tracks),
                "page": page,
                "limit": limit,
                "hasMore": end < len(all_tracks)
            }
        }

    # Default: return list of all songs for full catalogue
    return {"success": True, "data": all_tracks}

@app.get("/api/artist/{artist_id}/albums")
async def get_artist_albums(artist_id: str):
    artist_id = sanitize_id(artist_id)
    cache_key = f"artist_albums_{artist_id}"
    cached = cache.get(cache_key)
    if cached:
        return {"success": True, "data": cached}

    log_info(f"Fetching albums for artist {artist_id}")
    artist_data = await safe_ytmusic_call("get_artist", ytmusic.get_artist, artist_id)
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
    cache.set(cache_key, albums, ttl_seconds=TTL_ARTIST)
    return {"success": True, "data": albums}

# -------------------------------------------------------------
# ROUTES: ALBUM DETAIL
# -------------------------------------------------------------
@app.get("/api/album/{album_id}")
async def get_album_detail(album_id: str):
    album_id = sanitize_id(album_id)
    cache_key = f"album_{album_id}"
    cached = cache.get(cache_key)
    if cached:
        log_cache(f"Returning cached album details for {album_id}")
        return {"success": True, "data": cached}

    log_info(f"Fetching album details: {album_id}")
    album_data = await safe_ytmusic_call("get_album", ytmusic.get_album, album_id)
    
    title = album_data.get("title", "")
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
    cache.set(cache_key, result, ttl_seconds=TTL_ALBUM)
    return {"success": True, "data": result}

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
    
    song_title = title
    song_artist = artist
    lyrics_browse_id = None

    try:
        watch = await safe_ytmusic_call("get_watch_playlist", ytmusic.get_watch_playlist, videoId=video_id, limit=5)
        lyrics_browse_id = watch.get("lyrics")
        if not song_title and watch.get("tracks"):
            t = watch["tracks"][0]
            song_title = t.get("title")
            song_artist = extract_artists_str(t.get("artists"))
    except Exception as e:
        log_error(f"Watch playlist fetch for lyrics note: {e}")

    cleaned_title = song_title
    if cleaned_title:
        cleaned_title = re.sub(r"\(.*?\)|\[.*?\]", "", cleaned_title).strip()
        cleaned_title = re.sub(r"ft\..*|feat\..*", "", cleaned_title, flags=re.IGNORECASE).strip()

    # Priority 1: Check LRCLIB for synced lyrics (legal public API)
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
                            cache.set(cache_key, result, ttl_seconds=TTL_LYRICS)
                            return {"success": True, "data": result}
                    
                    if plain_lyrics:
                        result = {
                            "hasSynced": False,
                            "synced": None,
                            "plain": plain_lyrics,
                            "source": "LRCLIB Plain"
                        }
                        cache.set(cache_key, result, ttl_seconds=TTL_LYRICS)
                        return {"success": True, "data": result}
        except Exception as e:
            log_lyrics(f"LRCLIB request error: {e}")

    # Priority 2: Check YouTube Music official lyrics
    if lyrics_browse_id:
        try:
            log_lyrics(f"Fetching official YouTube Music lyrics browseId={lyrics_browse_id}")
            yt_lyrics = await safe_ytmusic_call("get_lyrics", ytmusic.get_lyrics, browseId=lyrics_browse_id)
            lyrics_text = yt_lyrics.get("lyrics", "")
            if lyrics_text and lyrics_text.strip():
                result = {
                    "hasSynced": False,
                    "synced": None,
                    "plain": lyrics_text,
                    "source": yt_lyrics.get("source", "YouTube Music")
                }
                cache.set(cache_key, result, ttl_seconds=TTL_LYRICS)
                return {"success": True, "data": result}
        except Exception as e:
            log_lyrics(f"YouTube Music lyrics fetch note: {e}")

    # Not found -> No fake lyrics
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
# ROUTES: AUDIO STREAM (YT-DLP EXTRACTION WITH REFRESH & CONCURRENCY)
# -------------------------------------------------------------
def run_ytdlp_extract(video_id: str) -> Optional[str]:
    """
    Runs fast yt-dlp extraction in worker thread.
    """
    ydl_opts = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "skip_download": True,
        "socket_timeout": 7,
        "noplaylist": True,
        "check_formats": False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        direct_url = info.get("url")
        if not direct_url:
            formats = info.get("formats", [])
            audio_formats = [f for f in formats if f.get("vcodec") == "none" and f.get("acodec") != "none"]
            if audio_formats:
                direct_url = audio_formats[-1].get("url")
        return direct_url

@app.get("/api/song/{video_id}/stream")
async def get_audio_stream(
    video_id: str,
    refresh: bool = Query(False, description="Force refresh stream URL bypassing cache")
):
    video_id = sanitize_id(video_id)
    cache_key = f"stream_url_{video_id}"

    if not refresh:
        cached_url = cache.get(cache_key)
        if cached_url:
            log_cache(f"Using cached stream URL for {video_id}")
            return RedirectResponse(url=cached_url, status_code=307)
    else:
        log_stream(f"Forced stream URL refresh requested for {video_id}")
        cache.delete(cache_key)

    log_stream(f"Extracting audio stream for {video_id}")

    # Guard concurrency with STREAM_SEMAPHORE
    async with STREAM_SEMAPHORE:
        direct_url = None
        try:
            log_ytdlp(f"Executing yt-dlp extraction for {video_id}")
            direct_url = await asyncio.wait_for(
                asyncio.to_thread(run_ytdlp_extract, video_id),
                timeout=12.0
            )
        except Exception as ytdlp_err:
            log_ytdlp(f"yt-dlp extraction error for {video_id}: {ytdlp_err}")

        if direct_url:
            log_stream(f"Successfully extracted direct stream URL for {video_id}")
            cache.set(cache_key, direct_url, ttl_seconds=TTL_STREAM)
            return RedirectResponse(url=direct_url, status_code=307)

    # Return structured JSON so frontend player engine seamlessly activates client-side playback
    log_stream(f"Direct stream URL could not be retrieved from server IP for {video_id}")
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "error": "Direct audio stream unavailable on current server network. Player engine will use client-side streaming.",
            "code": "STREAM_UNAVAILABLE",
            "retryable": True,
            "videoId": video_id
        }
    )
