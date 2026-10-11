(() => {
  'use strict';

  // Fallback platform check
  const platform = (window.mediavault && window.mediavault.platform) || 'win32';
  document.body.classList.add(platform === 'darwin' ? 'is-mac' : 'not-mac');

  // Application State
  const state = {
    filter: 'all',
    folder: 'all',
    seriesFilter: 'all',
    sort: 'date_added-desc',
    search: '',
    view: 'grid',
    selectedId: null,
    videos: [],
    allVideos: [],
    folders: [],
    counts: {},
    settings: {},
    isScanning: false
  };

  // DOM Elements
  const appEl = document.getElementById('app');
  const ambientEl = document.getElementById('ambient');
  const gridEl = document.getElementById('grid');
  const emptyStateEl = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const viewSwitcher = document.getElementById('view-switcher');
  const folderChipsEl = document.getElementById('folder-chips');
  const pageTitleEl = document.getElementById('page-title');
  const pageSubtitleEl = document.getElementById('page-subtitle');
  const scanBar = document.getElementById('scan-bar');
  const scanBarText = document.getElementById('scan-bar-text');
  const scanBarFill = document.getElementById('scan-bar-fill');
  const scanNote = document.getElementById('scan-note');
  const toastEl = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');

  // Detail Panel Elements (Exact clean layout from zip)
  const detailEl = document.getElementById('detail');
  const closeDetailBtn = document.getElementById('close-detail');
  const posterEl = document.getElementById('poster');
  const posterPlay = document.getElementById('poster-play');
  const dTitle = document.getElementById('d-title');
  const dFile = document.getElementById('d-file');
  const dDur = document.getElementById('d-dur');
  const dSize = document.getElementById('d-size');
  const dAdded = document.getElementById('d-added');
  const dPath = document.getElementById('d-path');
  const btnOpenVlc = document.getElementById('btn-open-vlc');
  const btnCopyPath = document.getElementById('btn-copy-path');
  const btnShowFolder = document.getElementById('btn-show-folder');

  // Context Menu Elements
  const contextMenu = document.getElementById('context-menu');
  const ctxPlay = document.getElementById('ctx-play');
  const ctxVlc = document.getElementById('ctx-vlc');
  const ctxFolder = document.getElementById('ctx-folder');
  const ctxCopy = document.getElementById('ctx-copy');
  const ctxFav = document.getElementById('ctx-fav');
  const ctxFavLabel = document.getElementById('ctx-fav-label');
  const ctxWatchlater = document.getElementById('ctx-watchlater');
  const ctxWatchlaterLabel = document.getElementById('ctx-watchlater-label');
  const ctxCompleted = document.getElementById('ctx-completed');
  const ctxCompletedLabel = document.getElementById('ctx-completed-label');
  const ctxDelete = document.getElementById('ctx-delete');
  let activeContextVideo = null;

  // In-App Theater Video Player Elements
  const theaterModal = document.getElementById('theater-modal');
  const theaterAmbient = document.getElementById('theater-ambient');
  const theaterHeader = theaterModal ? theaterModal.querySelector('.theater-header') : null;
  const theaterHud = document.getElementById('theater-hud');
  const theaterCloseBtn = document.getElementById('theater-close-btn');
  const theaterTitle = document.getElementById('theater-title');
  const theaterSpecs = document.getElementById('theater-specs');
  const theaterVlcBtn = document.getElementById('theater-vlc-btn');
  const theaterVideo = document.getElementById('theater-video');
  const theaterAudio = document.getElementById('theater-audio');
  const theaterCenterPlay = document.getElementById('theater-center-play');
  const theaterPlayToggle = document.getElementById('theater-play-toggle');
  const theaterPlayIcon = document.getElementById('theater-play-icon');
  const theaterRwBtn = document.getElementById('theater-rw-btn');
  const theaterFfBtn = document.getElementById('theater-ff-btn');
  const theaterCurrentTime = document.getElementById('theater-current-time');
  const theaterTotalTime = document.getElementById('theater-total-time');
  const theaterTimeline = document.getElementById('theater-timeline');
  const theaterTrack = document.getElementById('theater-track');
  const theaterFill = document.getElementById('theater-fill');
  const theaterBuffered = document.getElementById('theater-buffered');
  const theaterKnob = document.getElementById('theater-knob');
  const theaterScrubber = document.getElementById('theater-scrubber');
  const theaterTimeTooltip = document.getElementById('theater-time-tooltip');
  const theaterVolBtn = document.getElementById('theater-vol-btn');
  const theaterVolIcon = document.getElementById('theater-vol-icon');
  const theaterVolSlider = document.getElementById('theater-vol-slider');
  const theaterAudioBtn = document.getElementById('theater-audio-btn');
  const theaterAudioMenu = document.getElementById('theater-audio-menu');
  const theaterAudioList = document.getElementById('theater-audio-list');
  const theaterCcBtn = document.getElementById('theater-cc-btn');
  const theaterCcMenu = document.getElementById('theater-cc-menu');
  const theaterCcList = document.getElementById('theater-cc-list');
  const theaterSubFileInput = document.getElementById('theater-sub-file-input');
  const theaterSpeedBtn = document.getElementById('theater-speed-btn');
  const theaterFsBtn = document.getElementById('theater-fs-btn');
  const theaterFsIcon = document.getElementById('theater-fs-icon');

  // Modals
  const settingsModal = document.getElementById('settings-modal');
  const statsModal = document.getElementById('stats-modal');
  const btnSettingsTrigger = document.getElementById('btn-settings-trigger');
  const btnStatsTrigger = document.getElementById('btn-stats-trigger');
  const btnScan = document.getElementById('btn-scan');
  const btnRefresh = document.getElementById('btn-refresh');

  // Toast Helper
  let toastTimer = null;
  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toastText.textContent = msg;
    toastEl.classList.add('is-visible');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 2800);
  }

  // Formatting Helpers
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '—';
    const s = Math.round(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  }

  function formatDurationClock(seconds) {
    if (!seconds || seconds <= 0) return '';
    const s = Math.round(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${mins}:${pad(secs)}`;
  }

  function formatDateAdded(sec) {
    if (!sec) return 'Today';
    const ms = sec > 1e11 ? sec : sec * 1000;
    const d = new Date(ms);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays < 7 && diffDays > 0) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function cleanTitle(rawFilename) {
    if (!rawFilename) return 'Untitled';
    let name = rawFilename.replace(/\.[^/.]+$/, ''); // remove ext
    name = name.replace(/^[@_]+/, ''); // remove leading symbols
    name = name.replace(/RARBG/gi, '');

    // Replace dots, underscores, dashes surrounded by spaces
    name = name.replace(/[._]/g, ' ');

    // Match and isolate common release patterns
    const releaseTags = /\b(1080p|720p|480p|2160p|4k|uhd|hdr|hdrip|web[- ]?dl|webrip|bluray|brrip|dvdrip|hevc|x265|x264|h\.?264|h\.?265|av1|vp9|ddp5\.?1|dd5\.?1|aac|atmos|ac3|flux|bone|psa|yts|rarbg|xdmovies|10bit|remux)\b/gi;
    const match = releaseTags.exec(name);
    if (match && match.index > 2) {
      name = name.substring(0, match.index);
    }

    // Format year e.g. 2024 -> (2024) safely avoiding duplicates
    name = name.replace(/\(\s*(\d{4})\s*\)/g, ' $1 ').replace(/\b(19\d\d|20\d\d)\b/g, '($1)');

    // Clean multiple spaces
    name = name.replace(/\s+/g, ' ').trim();
    return name || rawFilename;
  }

  function formatMetaLine(video) {
    const parts = [];
    if (video.height) {
      if (video.height >= 2160 || video.width >= 3840) parts.push('4K');
      else if (video.height >= 1080 || video.width >= 1920) parts.push('1080p');
      else if (video.height >= 720 || video.width >= 1280) parts.push('720p');
      else parts.push('SD');
    }
    if (video.codec) {
      parts.push(video.codec.toUpperCase());
    }
    if (video.file_size) {
      parts.push(formatBytes(video.file_size));
    }
    return parts.join(' · ') || formatBytes(video.file_size || 0);
  }

  // ═══════════ TV Series Detection & Metadata Extraction ═══════════
  function extractSeriesInfo(filename) {
    if (!filename) return null;
    const clean = filename.replace(/[._-]/g, ' ');

    const seMatch = clean.match(/\bS(\d{1,2})E(\d{1,2})\b/i) || clean.match(/\b(\d{1,2})x(\d{1,2})\b/i);
    const sOnlyMatch = clean.match(/\bS(\d{1,2})\b/i) || clean.match(/\bSeason\s*(\d{1,2})\b/i);

    let season = null;
    let episode = null;
    let tag = null;

    if (seMatch) {
      season = parseInt(seMatch[1], 10);
      episode = parseInt(seMatch[2], 10);
      tag = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
    } else if (sOnlyMatch) {
      season = parseInt(sOnlyMatch[1], 10);
      tag = `Season ${season}`;
    }

    if (!tag) return null;

    let show = clean;
    const cutMatch = clean.match(/^(.*?)(?:\s+(?:S\d{1,2}|Season\s*\d+|\d{1,2}x\d{1,2}|\(\d{4}\)|\b(?:19\d\d|20\d\d)\b))/i);
    if (cutMatch && cutMatch[1] && cutMatch[1].trim().length > 1) {
      show = cutMatch[1].trim();
    } else {
      const idx = clean.search(/\bS\d{1,2}\b/i);
      if (idx > 0) show = clean.substring(0, idx).trim();
    }
    show = show.replace(/\b\w/g, (c) => c.toUpperCase());
    show = show.replace(/\s+(?:19\d\d|20\d\d)$/, '').trim();

    return { show, season, episode, tag };
  }

  // Clean, Neutral Specs (Monochrome Apple-style tokens)
  function getCleanSpecs(v) {
    if (!v) return [];
    const specs = [];
    const filename = v.filename || '';
    const nameLower = filename.toLowerCase();
    const w = v.width || 0;
    const h = v.height || 0;
    const c = (v.codec || '').toUpperCase();

    // If TV episode, show show name and tag
    const seriesInfo = extractSeriesInfo(filename);
    if (seriesInfo) {
      specs.push(seriesInfo.show);
      specs.push(seriesInfo.tag);
    }

    // Resolution
    if (h >= 2160 || w >= 3840 || /\b(2160p|4k|uhd)\b/i.test(nameLower)) {
      specs.push('4K UHD');
    } else if (h >= 1080 || w >= 1920 || /\b(1080p|fhd)\b/i.test(nameLower)) {
      specs.push('1080p FHD');
    } else if (h >= 720 || w >= 1280 || /\b(720p|hd)\b/i.test(nameLower)) {
      specs.push('720p HD');
    }

    // Codec
    if (c) {
      if (c === 'AV1') specs.push('AV1');
      else if (c === 'HEVC' || c === 'H265') specs.push('HEVC');
      else if (c === 'H264' || c === 'AVC') specs.push('H.264');
      else if (c === 'PRORES') specs.push('ProRes');
      else specs.push(c);
    }

    // Audio
    if (/\batmos\b/i.test(nameLower)) {
      specs.push('Dolby Atmos');
    } else if (/\b(ddp5\.?1|dd5\.?1|eac3)\b/i.test(nameLower) || v.audio_codec === 'eac3' || v.audio_channels === 6) {
      specs.push('DDP 5.1');
    } else if (/\bdts(-hd)?\b/i.test(nameLower)) {
      specs.push('DTS');
    }

    // Source
    if (/\bremux\b/i.test(nameLower)) specs.push('Remux');
    else if (/\b(bluray|bdrip)\b/i.test(nameLower)) specs.push('BluRay');
    else if (/\bweb[- ]?dl\b/i.test(nameLower)) specs.push('WEB-DL');
    else if (/\bwebrip\b/i.test(nameLower)) specs.push('WEBRip');

    return specs;
  }

  // Load All Library Data
  async function loadLibrary() {
    try {
      const isCustomCategory = state.filter === 'cat-series' || state.filter === 'cat-films' || state.filter === 'cat-clips';
      const backendFilter = isCustomCategory ? 'all' : state.filter;

      const [videos, counts, folders, settings] = await Promise.all([
        window.mediavault.getVideos({
          filter: backendFilter,
          folder: state.folder,
          sort: state.sort,
          search: state.search
        }),
        window.mediavault.getCounts(),
        window.mediavault.getScanFolders(),
        window.mediavault.getSettings()
      ]);

      const rawVideos = videos || [];
      if (!isCustomCategory && state.folder === 'all' && !state.search) {
        state.allVideos = rawVideos;
      } else if (!state.allVideos || state.allVideos.length === 0) {
        state.allVideos = rawVideos;
      }

      // Category Classification & Filtering
      if (state.filter === 'cat-series') {
        let seriesVids = rawVideos.filter((v) => !!extractSeriesInfo(v.filename));
        if (state.seriesFilter && state.seriesFilter !== 'all') {
          seriesVids = seriesVids.filter((v) => {
            const info = extractSeriesInfo(v.filename);
            return info && info.show === state.seriesFilter;
          });
        }
        state.videos = seriesVids;
      } else if (state.filter === 'cat-films') {
        state.videos = rawVideos.filter((v) => !extractSeriesInfo(v.filename) && (v.duration >= 2400 || (v.duration === null && (v.file_size || 0) > 400 * 1024 * 1024)));
      } else if (state.filter === 'cat-clips') {
        state.videos = rawVideos.filter((v) => !extractSeriesInfo(v.filename) && (v.duration < 300 || (v.duration === null && (v.file_size || 0) <= 400 * 1024 * 1024)));
      } else {
        state.videos = rawVideos;
      }

      state.counts = counts || {};
      state.folders = folders || [];
      state.settings = settings || {};

      if (settings && settings.last_scan_time) {
        const lastT = parseInt(settings.last_scan_time, 10);
        if (lastT > 0 && scanNote) {
          scanNote.textContent = `Last scan ${formatRelativeTime(lastT)}`;
        }
      }

      updateSidebarCounts();
      updateFilterChips();
      renderGrid();

      // If previously selected video is still present, update detail panel
      if (state.selectedId) {
        const stillExists = state.videos.find((v) => v.id === state.selectedId);
        if (stillExists) {
          selectVideo(stillExists, true);
        } else if (state.videos.length > 0) {
          selectVideo(state.videos[0], true);
        }
      } else if (state.videos.length > 0) {
        selectVideo(state.videos[0], true);
      }
    } catch (err) {
      console.error('Failed to load library:', err);
    }
  }

  // Update Sidebar Badge Counters
  function updateSidebarCounts() {
    const c = state.counts;
    const setBadge = (id, count) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = count || 0;
        el.style.display = count > 0 ? 'inline-block' : 'none';
      }
    };

    setBadge('count-all', c.all);
    setBadge('count-continue', c.continueWatching);
    setBadge('count-unwatched', c.unwatched);
    setBadge('count-favorites', c.favorites);
    setBadge('count-watch-later', c.watchLater);
    setBadge('count-completed', c.completed);

    // Compute categories from full library
    const sourceVideos = state.allVideos && state.allVideos.length > 0 ? state.allVideos : state.videos;
    let countSeries = 0;
    let countFilms = 0;
    let countClips = 0;
    for (const v of sourceVideos) {
      if (extractSeriesInfo(v.filename)) {
        countSeries++;
      } else if (v.duration >= 2400 || (v.duration === null && (v.file_size || 0) > 400 * 1024 * 1024)) {
        countFilms++;
      } else {
        countClips++;
      }
    }
    setBadge('count-series', countSeries);
    setBadge('count-films', countFilms);
    setBadge('count-clips', countClips);
  }

  // Update Filter Chips in Toolbar (Series filter when in TV Series, Folders otherwise)
  function updateFilterChips() {
    folderChipsEl.innerHTML = '';

    if (state.filter === 'cat-series') {
      const source = state.allVideos && state.allVideos.length > 0 ? state.allVideos : state.videos;
      const seriesMap = {};
      for (const v of source) {
        const info = extractSeriesInfo(v.filename);
        if (info) {
          seriesMap[info.show] = (seriesMap[info.show] || 0) + 1;
        }
      }

      const allBtn = document.createElement('button');
      const totalSeriesEps = Object.values(seriesMap).reduce((a, b) => a + b, 0);
      allBtn.textContent = `All Series (${totalSeriesEps})`;
      if (state.seriesFilter === 'all') allBtn.classList.add('is-on');
      allBtn.addEventListener('click', () => {
        state.seriesFilter = 'all';
        loadLibrary();
      });
      folderChipsEl.appendChild(allBtn);

      const shows = Object.keys(seriesMap).sort();
      for (const show of shows) {
        const btn = document.createElement('button');
        btn.textContent = `${show} (${seriesMap[show]})`;
        if (state.seriesFilter === show) btn.classList.add('is-on');
        btn.addEventListener('click', () => {
          state.seriesFilter = show;
          loadLibrary();
        });
        folderChipsEl.appendChild(btn);
      }
    } else {
      const allBtn = document.createElement('button');
      allBtn.textContent = 'All folders';
      allBtn.dataset.folder = 'all';
      if (state.folder === 'all') allBtn.classList.add('is-on');
      allBtn.addEventListener('click', () => {
        state.folder = 'all';
        loadLibrary();
      });
      folderChipsEl.appendChild(allBtn);

      for (const f of state.folders) {
        const btn = document.createElement('button');
        btn.textContent = `${f.folder_name} (${f.video_count || 0})`;
        btn.dataset.folder = f.folder_path;
        if (state.folder === f.folder_path) btn.classList.add('is-on');
        btn.addEventListener('click', () => {
          state.folder = f.folder_path;
          loadLibrary();
        });
        folderChipsEl.appendChild(btn);
      }
    }
  }

  // Create Card DOM Element (No AI pill badges!)
  function createCardElement(v) {
    const card = document.createElement('article');
    card.className = 'card' + (state.selectedId === v.id ? ' is-selected' : '');
    card.tabIndex = 0;
    card.dataset.id = v.id;

    const title = cleanTitle(v.filename);
    const meta = formatMetaLine(v);
    const durClock = formatDurationClock(v.duration);
    const sInfo = extractSeriesInfo(v.filename);
    const cardSubtitle = sInfo ? `${sInfo.tag} · ${meta}` : meta;

    // Thumbnail element
    const thumb = document.createElement('div');
    const sceneClass = `s${(v.id % 9) + 1}`;
    thumb.className = `thumb ${sceneClass}`;

    if (v.thumbnail_generated === 1 || v.thumbnail_path) {
      thumb.classList.add('has-thumb');
      thumb.style.setProperty('--thumb-img', `url('mediavault-thumb://thumb/${v.id}.jpg')`);
    }

    if (durClock) {
      const durSpan = document.createElement('span');
      durSpan.className = 'dur';
      durSpan.textContent = durClock;
      thumb.appendChild(durSpan);
    }

    if (v.is_favorite) {
      const favSpan = document.createElement('span');
      favSpan.className = 'fav';
      favSpan.innerHTML = '<svg class="icon icon--sm"><use href="#i-star-fill"/></svg>';
      thumb.appendChild(favSpan);
    }

    const playSpan = document.createElement('span');
    playSpan.className = 'play';
    playSpan.innerHTML = '<svg class="icon icon--lg"><use href="#i-play"/></svg>';
    playSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      selectVideo(v, true);
      openTheaterPlayer(v);
    });
    thumb.appendChild(playSpan);

    if (v.playback_position > 0 && !v.is_completed && v.duration > 0) {
      const progSpan = document.createElement('span');
      progSpan.className = 'prog';
      const pct = Math.min(100, Math.round((v.playback_position / v.duration) * 100));
      progSpan.innerHTML = `<i style="--p:${pct}%"></i>`;
      thumb.appendChild(progSpan);
    }

    card.appendChild(thumb);

    if (state.view === 'list') {
      const info = document.createElement('div');
      info.className = 'card__info';

      const h3 = document.createElement('h3');
      h3.className = 'card__title';
      h3.textContent = title;
      info.appendChild(h3);

      const p = document.createElement('p');
      p.className = 'card__meta';
      p.textContent = `${cardSubtitle} · ${v.folder_name}`;
      info.appendChild(p);

      card.appendChild(info);
    } else {
      const h3 = document.createElement('h3');
      h3.className = 'card__title';
      h3.textContent = title;
      card.appendChild(h3);

      const p = document.createElement('p');
      p.className = 'card__meta';
      p.textContent = cardSubtitle;
      card.appendChild(p);
    }

    // Card interactions
    card.addEventListener('click', () => selectVideo(v, true));
    card.addEventListener('dblclick', () => {
      selectVideo(v, true);
      openTheaterPlayer(v);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        selectVideo(v, true);
        openTheaterPlayer(v);
      }
    });
    card.addEventListener('contextmenu', (e) => {
      selectVideo(v, false);
      openContextMenu(e, v);
    });

    return card;
  }

  // Create Flowing TV Series Episode Row (No rigid rows/columns)
  function createEpisodeRow(v) {
    const row = document.createElement('div');
    row.className = 'series-ep-row glass' + (state.selectedId === v.id ? ' is-selected' : '');
    row.dataset.id = v.id;

    const sInfo = extractSeriesInfo(v.filename);
    const title = cleanTitle(v.filename);
    const meta = formatMetaLine(v);
    const durClock = formatDurationClock(v.duration);

    // Thumbnail
    const thumb = document.createElement('div');
    thumb.className = `series-ep-thumb s${(v.id % 9) + 1}`;
    if (v.thumbnail_generated === 1 || v.thumbnail_path) {
      thumb.classList.add('has-thumb');
      thumb.style.setProperty('--thumb-img', `url('mediavault-thumb://thumb/${v.id}.jpg')`);
    }
    if (durClock) {
      const dur = document.createElement('span');
      dur.className = 'dur';
      dur.textContent = durClock;
      thumb.appendChild(dur);
    }
    const playOverlay = document.createElement('div');
    playOverlay.className = 'ep-play-overlay';
    playOverlay.innerHTML = '<svg class="icon icon--lg"><use href="#i-play"/></svg>';
    thumb.appendChild(playOverlay);
    row.appendChild(thumb);

    // Info
    const info = document.createElement('div');
    info.className = 'series-ep-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'series-ep-title-row';

    if (sInfo && sInfo.tag) {
      const code = document.createElement('span');
      code.className = 'series-ep-code';
      code.textContent = sInfo.tag;
      titleRow.appendChild(code);
    }

    const titleEl = document.createElement('span');
    titleEl.className = 'series-ep-title';
    titleEl.textContent = title;
    titleRow.appendChild(titleEl);

    info.appendChild(titleRow);

    const metaEl = document.createElement('span');
    metaEl.className = 'series-ep-meta';
    metaEl.textContent = meta;
    info.appendChild(metaEl);

    row.appendChild(info);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'series-ep-actions';

    const playBtn = document.createElement('button');
    playBtn.className = 'btn-icon btn-icon--fill';
    playBtn.title = 'Play episode in mini VLC';
    playBtn.innerHTML = '<svg class="icon icon--sm"><use href="#i-play"/></svg>';
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectVideo(v, true);
      openTheaterPlayer(v);
    });
    actions.appendChild(playBtn);

    row.appendChild(actions);

    row.addEventListener('click', () => selectVideo(v, true));
    row.addEventListener('dblclick', () => {
      selectVideo(v, true);
      openTheaterPlayer(v);
    });
    row.addEventListener('contextmenu', (e) => {
      selectVideo(v, false);
      openContextMenu(e, v);
    });

    return row;
  }

  // Render Video Grid (Flowing by Series in TV Series view without rows/columns)
  function renderGrid() {
    gridEl.innerHTML = '';
    const vids = state.videos;

    const titles = {
      'all': 'All videos',
      'continue-watching': 'Continue watching',
      'recently-added': 'Recently added',
      'unwatched': 'Unwatched',
      'favorites': 'Favorites',
      'watch-later': 'Watch later',
      'completed': 'Completed',
      'cat-series': state.seriesFilter && state.seriesFilter !== 'all' ? state.seriesFilter : 'TV Series',
      'cat-films': 'Films',
      'cat-clips': 'Short clips'
    };

    pageTitleEl.textContent = titles[state.filter] || 'Videos';
    pageSubtitleEl.textContent = `${vids.length} videos · sorted by ${sortSelect.options[sortSelect.selectedIndex]?.text || 'recently added'}`;

    if (vids.length === 0) {
      emptyStateEl.style.display = 'flex';
      return;
    }
    emptyStateEl.style.display = 'none';

    // Apply view mode layout class
    gridEl.className = 'grid';
    if (state.view === 'dense') gridEl.classList.add('grid--dense');
    if (state.view === 'list') gridEl.classList.add('grid--list');

    // TV Series Browsing: Flowing show sections without rows/columns
    if (state.filter === 'cat-series') {
      gridEl.className = 'grid grid--series';
      const seriesGroups = {};
      for (const v of vids) {
        const sInfo = extractSeriesInfo(v.filename);
        const show = sInfo ? sInfo.show : 'Other Shows';
        if (!seriesGroups[show]) seriesGroups[show] = [];
        seriesGroups[show].push(v);
      }

      const container = document.createDocumentFragment();
      for (const show of Object.keys(seriesGroups).sort()) {
        const eps = seriesGroups[show];
        eps.sort((a, b) => {
          const aInfo = extractSeriesInfo(a.filename);
          const bInfo = extractSeriesInfo(b.filename);
          const aVal = ((aInfo?.season || 1) * 1000) + (aInfo?.episode || 0);
          const bVal = ((bInfo?.season || 1) * 1000) + (bInfo?.episode || 0);
          return aVal - bVal;
        });

        const block = document.createElement('div');
        block.className = 'series-block';

        const head = document.createElement('div');
        head.className = 'series-block__head';
        head.innerHTML = `
          <h2 class="series-block__name">${show}</h2>
          <span class="series-block__count">${eps.length} ${eps.length === 1 ? 'episode' : 'episodes'}</span>
        `;
        block.appendChild(head);

        const epList = document.createElement('div');
        epList.className = 'series-episodes-list';

        for (const ep of eps) {
          epList.appendChild(createEpisodeRow(ep));
        }

        block.appendChild(epList);
        container.appendChild(block);
      }
      gridEl.appendChild(container);
      if (window.LumenGlass && window.LumenGlass.refresh) {
        window.LumenGlass.refresh();
      }
      return;
    }

    // Standard Grid Render (Films, Short Clips, All videos)
    const fragment = document.createDocumentFragment();
    for (const v of vids) {
      fragment.appendChild(createCardElement(v));
    }
    gridEl.appendChild(fragment);
    if (window.LumenGlass && window.LumenGlass.refresh) {
      window.LumenGlass.refresh();
    }
  }

  // Select a Video and populate Details Inspector
  function selectVideo(v, openPanel = true) {
    state.selectedId = v.id;

    // Highlight card
    document.querySelectorAll('.card.is-selected').forEach((c) => c.classList.remove('is-selected'));
    const targetCard = document.querySelector(`.card[data-id="${v.id}"]`);
    if (targetCard) targetCard.classList.add('is-selected');

    if (openPanel) {
      appEl.classList.add('has-panel');
      if (window.LumenGlass && window.LumenGlass.refresh) {
        requestAnimationFrame(() => window.LumenGlass.refresh());
      }
    }

    // Dynamic Ambient Backdrop & Poster Artwork
    const sceneClass = `s${(v.id % 9) + 1}`;
    ambientEl.className = `ambient ${sceneClass}`;
    posterEl.className = `poster ${sceneClass}`;

    if (v.thumbnail_generated === 1 || v.thumbnail_path) {
      const thumbUrl = `url('mediavault-thumb://thumb/${v.id}.jpg')`;
      posterEl.classList.add('has-thumb');
      ambientEl.classList.add('has-thumb');
      posterEl.style.setProperty('--thumb-img', thumbUrl);
      ambientEl.style.setProperty('--thumb-img', thumbUrl);
    } else {
      posterEl.classList.remove('has-thumb');
      ambientEl.classList.remove('has-thumb');
      posterEl.style.removeProperty('--thumb-img');
      ambientEl.style.removeProperty('--thumb-img');
    }

    // Populate details - exact match to zip & user screenshot
    dTitle.textContent = cleanTitle(v.filename);
    dFile.textContent = v.filename;
    dDur.textContent = formatDuration(v.duration);
    dSize.textContent = formatBytes(v.file_size);
    if (dAdded) dAdded.textContent = formatDateAdded(v.date_added);
    dPath.textContent = v.file_path || '—';
  }

  // ═══════════ In-App Theater Video Player (Powered by VLC) ═══════════
  let currentPlayingVideo = null;
  let hudHideTimeout = null;
  let savePositionInterval = null;

  function resetHudHideTimer() {
    if (!theaterModal || !theaterModal.classList.contains('is-open')) return;
    if (theaterHud) theaterHud.classList.remove('is-hidden');
    if (theaterVideo) theaterVideo.style.cursor = 'default';
    clearTimeout(hudHideTimeout);
    if (theaterVideo && !theaterVideo.paused) {
      hudHideTimeout = setTimeout(() => {
        if (theaterVideo && !theaterVideo.paused) {
          if (theaterHud) theaterHud.classList.add('is-hidden');
          if (theaterVideo) theaterVideo.style.cursor = 'none';
        }
      }, 3000);
    }
  }

  function openTheaterPlayer(video) {
    if (!video || !theaterModal) return;
    currentPlayingVideo = video;

    // Display clean name in bottom bar HUD itself, truncated with ellipsis, NO metadata tags
    if (theaterTitle) {
      theaterTitle.textContent = cleanTitle(video.filename);
      theaterTitle.title = video.filename;
    }

    if (theaterAmbient) {
      theaterAmbient.style.backgroundImage = `url('mediavault-thumb://thumb/${video.id}.jpg')`;
    }

    // Reset progress UI
    theaterFill.style.width = '0%';
    if (theaterKnob) theaterKnob.style.left = '0%';
    theaterBuffered.style.width = '0%';
    theaterScrubber.value = '0';
    theaterCurrentTime.textContent = '00:00';
    theaterTotalTime.textContent = formatDurationClock(video.duration || 0);

    // Set video stream source via privileged protocol
    theaterVideo.src = `mediavault-stream://video/${video.id}`;

    // Open Modal
    theaterModal.classList.add('is-open');
    theaterModal.setAttribute('aria-hidden', 'false');

    // Trigger authentic squircle refractive glass render on theater HUD
    if (window.LumenGlass && window.LumenGlass.refresh) {
      requestAnimationFrame(() => window.LumenGlass.refresh());
    }

    theaterVideo.onloadedmetadata = () => {
      theaterTotalTime.textContent = formatDurationClock(theaterVideo.duration);
      if (video.playback_position > 3 && !video.is_completed) {
        theaterVideo.currentTime = video.playback_position;
        const pct = (video.playback_position / (theaterVideo.duration || 1)) * 100;
        if (theaterFill) theaterFill.style.width = `${pct}%`;
        if (theaterKnob) theaterKnob.style.left = `${pct}%`;
        if (theaterScrubber) theaterScrubber.value = String(pct);
      }
      theaterVideo.play().catch(() => {});
      if (isAudioFallbackActive && theaterAudio && theaterAudio.paused) {
        theaterAudio.play().catch(() => {});
      }
    };

    // Auto-save progress every 5 seconds
    clearInterval(savePositionInterval);
    savePositionInterval = setInterval(() => {
      if (currentPlayingVideo && theaterVideo && !theaterVideo.paused && theaterVideo.currentTime > 0) {
        window.mediavault.updatePlaybackPosition(currentPlayingVideo.id, theaterVideo.currentTime, theaterVideo.duration);
      }
    }, 5000);

    resetHudHideTimer();
    loadMediaTracks(video);
  }

  function closeTheaterPlayer() {
    if (!theaterModal || !theaterModal.classList.contains('is-open')) return;
    if (currentPlayingVideo && theaterVideo && theaterVideo.currentTime > 0) {
      window.mediavault.updatePlaybackPosition(currentPlayingVideo.id, theaterVideo.currentTime, theaterVideo.duration);
    }
    clearInterval(savePositionInterval);
    clearTimeout(hudHideTimeout);
    clearTimeout(audioSeekSyncTimer);
    if (theaterVideo) {
      theaterVideo.pause();
      theaterVideo.src = '';
    }
    if (theaterAudio) {
      theaterAudio.pause();
      theaterAudio.src = '';
    }
    isAudioFallbackActive = false;
    if (theaterAudioMenu) theaterAudioMenu.style.display = 'none';
    if (theaterCcMenu) theaterCcMenu.style.display = 'none';
    activeSubtitleIndex = -1;
    loadedSubtitles = [];
    theaterModal.classList.remove('is-open');
    theaterModal.setAttribute('aria-hidden', 'true');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    loadLibrary();
  }

  // ── Subtitle & Audio Tracks Management ──
  const NATIVE_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm_s16le', 'pcm_u8', 'pcm_s24le', 'pcm_s32le', 'wav']);
  let activeSubtitleIndex = -1; // -1 = off
  let loadedSubtitles = []; // { id, label, track }
  let loadedAudioTracks = [];
  let selectedAudioTrackIndex = 0;
  let isAudioFallbackActive = false;
  let audioStreamStartOffset = 0;
  let audioSeekSyncTimer = null;

  function srtToVtt(srtText) {
    return 'WEBVTT\n\n' + srtText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  }

  function syncAudioFallback(seekTime) {
    if (!currentPlayingVideo || !theaterVideo || !theaterAudio) return;

    const currentTrack = loadedAudioTracks[selectedAudioTrackIndex];
    const codec = (currentTrack?.codec || currentPlayingVideo.audio_codec || '').toLowerCase();

    // Check if codec is unsupported by Chromium (e.g. eac3, ac3, dts, truehd, ddp)
    const isUnsupported = !NATIVE_AUDIO_CODECS.has(codec) && (
      codec.includes('ac3') || 
      codec.includes('dts') || 
      codec.includes('truehd') || 
      codec.includes('ddp') || 
      codec.includes('mlp') ||
      codec.includes('wma') ||
      codec === ''
    );

    if (isUnsupported) {
      isAudioFallbackActive = true;
      theaterVideo.muted = true; // Mute Chromium video to avoid audio errors/stuttering
      const audioIdx = currentTrack ? currentTrack.audioIndex : 0;
      const startSec = Math.max(0, seekTime !== undefined ? seekTime : (theaterVideo.currentTime || 0));
      audioStreamStartOffset = startSec;
      theaterAudio.src = `mediavault-stream://audio/${currentPlayingVideo.id}/${audioIdx}?start=${startSec.toFixed(2)}&_t=${Date.now()}`;
      theaterAudio.volume = theaterVideo.volume;
      theaterAudio.playbackRate = theaterVideo.playbackRate || 1.0;
      if (!theaterVideo.paused) {
        theaterAudio.play().catch(() => {});
      }
    } else {
      isAudioFallbackActive = false;
      theaterVideo.muted = false;
      theaterAudio.pause();
      theaterAudio.src = '';
    }
  }

  async function loadMediaTracks(video) {
    selectedAudioTrackIndex = 0;
    while (theaterVideo && theaterVideo.firstChild) {
      theaterVideo.removeChild(theaterVideo.firstChild);
    }
    loadedSubtitles = [];
    activeSubtitleIndex = -1;

    try {
      const data = await window.mediavault.getMediaTracks(video.id);
      loadedAudioTracks = data.audioTracks || [];
      renderAudioList();
      syncAudioFallback(theaterVideo.currentTime);

      const sidecars = data.sidecars || [];
      const embeddedSubs = data.subtitleTracks || [];

      sidecars.forEach((s, idx) => {
        let vttText = s.content;
        if (s.ext === '.srt') {
          vttText = srtToVtt(s.content);
        }
        const blobUrl = URL.createObjectURL(new Blob([vttText], { type: 'text/vtt' }));
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = s.filename;
        track.srclang = 'en';
        track.src = blobUrl;
        theaterVideo.appendChild(track);
        loadedSubtitles.push({
          id: `sidecar-${idx}`,
          label: s.filename,
          track
        });
      });

      embeddedSubs.forEach((sub, idx) => {
        loadedSubtitles.push({
          id: `embed-${idx}`,
          label: sub.title || `Subtitle ${idx + 1} (${sub.language || 'Embedded'})`,
          embeddedIndex: sub.index
        });
      });

      renderSubtitleList();
    } catch (err) {
      console.warn('Error loading media tracks:', err);
    }
  }

  function renderAudioList() {
    if (!theaterAudioList) return;
    theaterAudioList.innerHTML = '';

    const htmlAudioTracks = theaterVideo ? theaterVideo.audioTracks : null;
    const count = Math.max(
      (htmlAudioTracks && htmlAudioTracks.length) || 0,
      loadedAudioTracks.length,
      1
    );

    for (let i = 0; i < count; i++) {
      const item = document.createElement('button');
      item.className = 'theater-popover-item';
      
      let label = `Soundtrack ${i + 1}`;
      if (loadedAudioTracks[i]) {
        label = loadedAudioTracks[i].title;
      } else if (htmlAudioTracks && htmlAudioTracks[i]) {
        label = htmlAudioTracks[i].label || htmlAudioTracks[i].language || `Soundtrack ${i + 1}`;
      }

      if (i === selectedAudioTrackIndex) {
        item.classList.add('is-selected');
      }

      item.textContent = label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedAudioTrackIndex = i;
        if (htmlAudioTracks && htmlAudioTracks.length > i) {
          for (let j = 0; j < htmlAudioTracks.length; j++) {
            htmlAudioTracks[j].enabled = (j === i);
          }
        }
        document.querySelectorAll('#theater-audio-list .theater-popover-item').forEach((el, idx) => {
          el.classList.toggle('is-selected', idx === i);
        });
        syncAudioFallback(theaterVideo.currentTime);
        showToast(`Soundtrack: ${label}`);
        if (theaterAudioMenu) theaterAudioMenu.style.display = 'none';
      });
      theaterAudioList.appendChild(item);
    }
  }

  function renderSubtitleList() {
    if (!theaterCcList) return;
    theaterCcList.innerHTML = '';

    const offItem = document.createElement('button');
    offItem.className = 'theater-popover-item' + (activeSubtitleIndex === -1 ? ' is-selected' : '');
    offItem.textContent = 'Off';
    offItem.addEventListener('click', (e) => {
      e.stopPropagation();
      setSubtitleTrack(-1);
      if (theaterCcMenu) theaterCcMenu.style.display = 'none';
    });
    theaterCcList.appendChild(offItem);

    loadedSubtitles.forEach((sub, idx) => {
      const item = document.createElement('button');
      item.className = 'theater-popover-item' + (activeSubtitleIndex === idx ? ' is-selected' : '');
      item.textContent = sub.label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setSubtitleTrack(idx);
        if (theaterCcMenu) theaterCcMenu.style.display = 'none';
      });
      theaterCcList.appendChild(item);
    });
  }

  function setSubtitleTrack(index) {
    activeSubtitleIndex = index;
    if (theaterVideo) {
      for (let i = 0; i < theaterVideo.textTracks.length; i++) {
        theaterVideo.textTracks[i].mode = 'disabled';
      }
    }

    if (index >= 0 && loadedSubtitles[index]) {
      const sub = loadedSubtitles[index];
      if (sub.track && sub.track.track) {
        sub.track.track.mode = 'showing';
      } else if (theaterVideo && theaterVideo.textTracks[index]) {
        theaterVideo.textTracks[index].mode = 'showing';
      }
      showToast(`Subtitles: ${sub.label}`);
    } else {
      showToast('Subtitles Off');
    }
    renderSubtitleList();
  }

  function cycleSubtitles() {
    if (loadedSubtitles.length === 0) return;
    const nextIdx = (activeSubtitleIndex + 1) >= loadedSubtitles.length ? -1 : activeSubtitleIndex + 1;
    setSubtitleTrack(nextIdx);
  }

  if (theaterSubFileInput) {
    theaterSubFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const vttText = file.name.endsWith('.srt') ? srtToVtt(text) : text;
        const blobUrl = URL.createObjectURL(new Blob([vttText], { type: 'text/vtt' }));
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = file.name;
        track.srclang = 'en';
        track.src = blobUrl;
        if (theaterVideo) theaterVideo.appendChild(track);
        const newIdx = loadedSubtitles.length;
        loadedSubtitles.push({
          id: `custom-${Date.now()}`,
          label: file.name,
          track
        });
        setSubtitleTrack(newIdx);
        if (theaterCcMenu) theaterCcMenu.style.display = 'none';
      } catch (err) {
        showToast('Failed to load subtitle file');
      }
      theaterSubFileInput.value = '';
    });
  }

  if (theaterAudioBtn && theaterAudioMenu) {
    theaterAudioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = theaterAudioMenu.style.display !== 'none';
      theaterAudioMenu.style.display = isVisible ? 'none' : 'flex';
      if (theaterCcMenu) theaterCcMenu.style.display = 'none';
    });
  }

  if (theaterCcBtn && theaterCcMenu) {
    theaterCcBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = theaterCcMenu.style.display !== 'none';
      theaterCcMenu.style.display = isVisible ? 'none' : 'flex';
      if (theaterAudioMenu) theaterAudioMenu.style.display = 'none';
    });
  }

  document.addEventListener('click', (e) => {
    if (theaterAudioMenu && !e.target.closest('#theater-audio-container')) {
      theaterAudioMenu.style.display = 'none';
    }
    if (theaterCcMenu && !e.target.closest('#theater-cc-container')) {
      theaterCcMenu.style.display = 'none';
    }
  });

  function togglePlayPause() {
    if (!theaterVideo) return;
    if (theaterVideo.paused) {
      theaterVideo.play().catch(() => {});
      if (isAudioFallbackActive && theaterAudio && theaterAudio.paused) {
        theaterAudio.play().catch(() => {});
      }
      theaterPlayIcon.innerHTML = '<use href="#i-pause"/>';
      showCenterPulse('play');
    } else {
      theaterVideo.pause();
      if (isAudioFallbackActive && theaterAudio) {
        theaterAudio.pause();
      }
      theaterPlayIcon.innerHTML = '<use href="#i-play"/>';
      showCenterPulse('pause');
    }
    resetHudHideTimer();
  }

  function showCenterPulse(type) {
    if (!theaterCenterPlay) return;
    theaterCenterPlay.innerHTML = `<svg class="icon icon--lg"><use href="#i-${type}"/></svg>`;
    theaterCenterPlay.classList.add('is-visible');
    setTimeout(() => theaterCenterPlay.classList.remove('is-visible'), 500);
  }

  if (theaterPlayToggle) theaterPlayToggle.addEventListener('click', togglePlayPause);
  if (theaterCloseBtn) theaterCloseBtn.addEventListener('click', closeTheaterPlayer);

  // Viewport Click/Drag Protection (prevent dragging viewport from triggering accidental pause/play)
  const theaterViewport = document.getElementById('theater-viewport');
  let vpPointerStart = null;
  if (theaterViewport) {
    theaterViewport.addEventListener('pointerdown', (e) => {
      vpPointerStart = { x: e.clientX, y: e.clientY, time: Date.now() };
    });
    theaterViewport.addEventListener('pointerup', (e) => {
      if (!vpPointerStart) return;
      const dist = Math.hypot(e.clientX - vpPointerStart.x, e.clientY - vpPointerStart.y);
      const elapsed = Date.now() - vpPointerStart.time;
      vpPointerStart = null;
      if (dist < 6 && elapsed < 400) {
        if (e.target === theaterVideo || e.target === theaterViewport) {
          togglePlayPause();
        }
      }
    });
  }

  if (theaterVlcBtn) {
    theaterVlcBtn.addEventListener('click', async () => {
      if (!currentPlayingVideo) return;
      const curTime = theaterVideo ? theaterVideo.currentTime : 0;
      if (theaterVideo) theaterVideo.pause();
      showToast(`Handoff to VLC at ${formatDurationClock(curTime)}...`);
      await window.mediavault.openInVlc(currentPlayingVideo.id, curTime);
    });
  }

  if (theaterRwBtn) {
    theaterRwBtn.addEventListener('click', () => {
      if (theaterVideo) theaterVideo.currentTime = Math.max(0, theaterVideo.currentTime - 10);
      resetHudHideTimer();
    });
  }

  if (theaterFfBtn) {
    theaterFfBtn.addEventListener('click', () => {
      if (theaterVideo) theaterVideo.currentTime = Math.min(theaterVideo.duration || 0, theaterVideo.currentTime + 10);
      resetHudHideTimer();
    });
  }

  let isScrubbing = false;
  let liveSeekRaf = null;
  let lastLiveSeekTime = 0;

  function performLiveFrameSeek(targetTime) {
    const now = Date.now();
    if (now - lastLiveSeekTime > 60) {
      lastLiveSeekTime = now;
      if (theaterVideo && theaterVideo.readyState >= 1) {
        theaterVideo.currentTime = targetTime;
      }
    } else if (!liveSeekRaf) {
      liveSeekRaf = requestAnimationFrame(() => {
        liveSeekRaf = null;
        if (theaterVideo && theaterVideo.readyState >= 1) {
          theaterVideo.currentTime = targetTime;
        }
      });
    }
  }

  if (theaterVideo) {
    theaterVideo.addEventListener('dragstart', (e) => e.preventDefault());

    theaterVideo.addEventListener('timeupdate', () => {
      if (isScrubbing) return; // Do not overwrite while dragging scrubber
      const cur = theaterVideo.currentTime;
      const dur = theaterVideo.duration || 1;
      const pct = (cur / dur) * 100;
      if (theaterFill) theaterFill.style.width = `${pct}%`;
      if (theaterKnob) theaterKnob.style.left = `${pct}%`;
      if (theaterScrubber) theaterScrubber.value = String(pct);
      if (theaterCurrentTime) theaterCurrentTime.textContent = formatDurationClock(cur);

      // Audio drift recovery for live transcode stream
      if (isAudioFallbackActive && theaterAudio && !theaterVideo.paused && !theaterAudio.paused) {
        const audioPos = audioStreamStartOffset + theaterAudio.currentTime;
        if (Math.abs(cur - audioPos) > 0.65) {
          syncAudioFallback(cur);
        }
      }
    });

    theaterVideo.addEventListener('seeked', () => {
      const cur = theaterVideo.currentTime;
      const dur = theaterVideo.duration || 1;
      const pct = (cur / dur) * 100;
      if (theaterFill) theaterFill.style.width = `${pct}%`;
      if (theaterKnob) theaterKnob.style.left = `${pct}%`;
      if (theaterScrubber) theaterScrubber.value = String(pct);
      if (theaterCurrentTime) theaterCurrentTime.textContent = formatDurationClock(cur);

      if (isAudioFallbackActive && !isScrubbing) {
        clearTimeout(audioSeekSyncTimer);
        audioSeekSyncTimer = setTimeout(() => {
          syncAudioFallback(cur);
        }, 80);
      }
    });

    theaterVideo.addEventListener('progress', () => {
      if (theaterVideo.buffered.length > 0) {
        const bufferedEnd = theaterVideo.buffered.end(theaterVideo.buffered.length - 1);
        const dur = theaterVideo.duration || 1;
        if (theaterBuffered) theaterBuffered.style.width = `${(bufferedEnd / dur) * 100}%`;
      }
    });

    theaterVideo.addEventListener('play', () => {
      if (isAudioFallbackActive && theaterAudio && theaterAudio.paused) {
        theaterAudio.play().catch(() => {});
      }
      if (theaterPlayIcon) theaterPlayIcon.innerHTML = '<use href="#i-pause"/>';
      resetHudHideTimer();
    });

    theaterVideo.addEventListener('pause', () => {
      if (isAudioFallbackActive && theaterAudio) {
        theaterAudio.pause();
      }
      if (theaterPlayIcon) theaterPlayIcon.innerHTML = '<use href="#i-play"/>';
      if (theaterHud) theaterHud.classList.remove('is-hidden');
      if (theaterVideo) theaterVideo.style.cursor = 'default';
    });

    theaterVideo.addEventListener('ended', () => {
      if (isAudioFallbackActive && theaterAudio) {
        theaterAudio.pause();
      }
      if (currentPlayingVideo) {
        window.mediavault.updatePlaybackPosition(currentPlayingVideo.id, theaterVideo.duration, theaterVideo.duration);
      }
      if (theaterPlayIcon) theaterPlayIcon.innerHTML = '<use href="#i-play"/>';
      showToast('Video completed');
    });
  }

  // Smooth Scrubber Dragging with Tactile Knob & Real-Time Seeking like VLC
  if (theaterScrubber) {
    const handleScrubMove = (e) => {
      if (!isScrubbing) return;
      const rect = theaterScrubber.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const pct = pos * 100;
      theaterScrubber.value = String(pct);
      if (theaterFill) theaterFill.style.width = `${pct}%`;
      if (theaterKnob) theaterKnob.style.left = `${pct}%`;
      const dur = theaterVideo ? (theaterVideo.duration || 1) : 1;
      const targetTime = pos * dur;
      if (theaterCurrentTime) theaterCurrentTime.textContent = formatDurationClock(targetTime);
      if (theaterTimeTooltip) {
        theaterTimeTooltip.textContent = formatDurationClock(targetTime);
        theaterTimeTooltip.style.left = `${pct}%`;
        theaterTimeTooltip.style.opacity = '1';
      }
      performLiveFrameSeek(targetTime);
      resetHudHideTimer();
    };

    const handleScrubEnd = (e) => {
      if (!isScrubbing) return;
      isScrubbing = false;
      if (theaterTimeline) theaterTimeline.classList.remove('is-scrubbing');
      try { theaterScrubber.releasePointerCapture(e.pointerId); } catch (_) {}
      if (liveSeekRaf) cancelAnimationFrame(liveSeekRaf);

      const rect = theaterScrubber.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dur = theaterVideo ? (theaterVideo.duration || 1) : 1;
      const targetTime = pos * dur;
      if (theaterVideo) {
        theaterVideo.currentTime = targetTime;
        if (isAudioFallbackActive) {
          syncAudioFallback(targetTime);
        }
      }
      if (theaterTimeTooltip) theaterTimeTooltip.style.opacity = '0';
      resetHudHideTimer();
    };

    theaterScrubber.addEventListener('pointerdown', (e) => {
      isScrubbing = true;
      if (theaterTimeline) theaterTimeline.classList.add('is-scrubbing');
      try { theaterScrubber.setPointerCapture(e.pointerId); } catch (_) {}
      handleScrubMove(e);
    });
    theaterScrubber.addEventListener('pointermove', handleScrubMove);
    theaterScrubber.addEventListener('pointerup', handleScrubEnd);
    theaterScrubber.addEventListener('pointercancel', handleScrubEnd);

    theaterScrubber.addEventListener('input', (e) => {
      const pct = parseFloat(e.target.value);
      const dur = theaterVideo ? (theaterVideo.duration || 1) : 1;
      if (theaterFill) theaterFill.style.width = `${pct}%`;
      if (theaterKnob) theaterKnob.style.left = `${pct}%`;
      const targetTime = (pct / 100) * dur;
      if (theaterCurrentTime) theaterCurrentTime.textContent = formatDurationClock(targetTime);
      if (theaterVideo) {
        theaterVideo.currentTime = targetTime;
      }
      resetHudHideTimer();
    });

    theaterScrubber.addEventListener('change', (e) => {
      const pct = parseFloat(e.target.value);
      const dur = theaterVideo ? (theaterVideo.duration || 1) : 1;
      const targetTime = (pct / 100) * dur;
      if (theaterVideo) {
        theaterVideo.currentTime = targetTime;
        if (isAudioFallbackActive) {
          syncAudioFallback(targetTime);
        }
      }
      isScrubbing = false;
      if (theaterTimeline) theaterTimeline.classList.remove('is-scrubbing');
    });
  }

  if (theaterTrack) {
    theaterTrack.addEventListener('mousemove', (e) => {
      if (isScrubbing) return;
      const rect = theaterTrack.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dur = theaterVideo ? (theaterVideo.duration || 0) : 0;
      if (theaterTimeTooltip) {
        theaterTimeTooltip.textContent = formatDurationClock(pos * dur);
        theaterTimeTooltip.style.left = `${pos * 100}%`;
        theaterTimeTooltip.style.opacity = '1';
      }
    });
    theaterTrack.addEventListener('mouseleave', () => {
      if (!isScrubbing && theaterTimeTooltip) {
        theaterTimeTooltip.style.opacity = '0';
      }
    });
  }

  if (theaterVolSlider) {
    theaterVolSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (theaterVideo) {
        theaterVideo.volume = val;
        if (!isAudioFallbackActive) {
          theaterVideo.muted = val === 0;
        }
      }
      if (theaterAudio) {
        theaterAudio.volume = val;
        theaterAudio.muted = val === 0;
      }
      if (theaterVolIcon) theaterVolIcon.innerHTML = `<use href="#${val === 0 ? 'i-volume-x' : 'i-volume'}"/>`;
      resetHudHideTimer();
    });
  }

  if (theaterVolBtn) {
    theaterVolBtn.addEventListener('click', () => {
      if (isAudioFallbackActive && theaterAudio) {
        const nextMuted = !theaterAudio.muted;
        theaterAudio.muted = nextMuted;
        if (theaterVolIcon) theaterVolIcon.innerHTML = `<use href="#${nextMuted ? 'i-volume-x' : 'i-volume'}"/>`;
        if (theaterVolSlider) theaterVolSlider.value = nextMuted ? '0' : String(theaterAudio.volume || 1);
      } else if (theaterVideo) {
        theaterVideo.muted = !theaterVideo.muted;
        if (theaterVolIcon) theaterVolIcon.innerHTML = `<use href="#${theaterVideo.muted ? 'i-volume-x' : 'i-volume'}"/>`;
        if (theaterVolSlider) theaterVolSlider.value = theaterVideo.muted ? '0' : String(theaterVideo.volume || 1);
      }
      resetHudHideTimer();
    });
  }

  const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
  let speedIdx = 0;
  if (theaterSpeedBtn) {
    theaterSpeedBtn.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      const rate = speeds[speedIdx];
      if (theaterVideo) theaterVideo.playbackRate = rate;
      if (theaterAudio) theaterAudio.playbackRate = rate;
      theaterSpeedBtn.textContent = `${rate}x`;
      resetHudHideTimer();
    });
  }

  if (theaterFsBtn) {
    theaterFsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        if (theaterModal) theaterModal.requestFullscreen().catch(() => {});
        if (theaterFsIcon) theaterFsIcon.innerHTML = '<use href="#i-minimize"/>';
      } else {
        document.exitFullscreen().catch(() => {});
        if (theaterFsIcon) theaterFsIcon.innerHTML = '<use href="#i-maximize"/>';
      }
      resetHudHideTimer();
    });
  }

  if (theaterModal) {
    theaterModal.addEventListener('mousemove', resetHudHideTimer);
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (theaterModal && theaterModal.classList.contains('is-open')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeTheaterPlayer();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (theaterVideo) theaterVideo.currentTime = Math.max(0, theaterVideo.currentTime - 10);
        resetHudHideTimer();
      } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        if (theaterVideo) theaterVideo.currentTime = Math.min(theaterVideo.duration || 0, theaterVideo.currentTime + 10);
        resetHudHideTimer();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const curVol = (isAudioFallbackActive && theaterAudio) ? theaterAudio.volume : (theaterVideo ? theaterVideo.volume : 1);
        const newVol = Math.min(1, curVol + 0.1);
        if (theaterVideo) {
          theaterVideo.volume = newVol;
          if (!isAudioFallbackActive) theaterVideo.muted = false;
        }
        if (theaterAudio) {
          theaterAudio.volume = newVol;
          theaterAudio.muted = false;
        }
        if (theaterVolSlider) theaterVolSlider.value = String(newVol);
        if (theaterVolIcon) theaterVolIcon.innerHTML = '<use href="#i-volume"/>';
        resetHudHideTimer();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const curVol = (isAudioFallbackActive && theaterAudio) ? theaterAudio.volume : (theaterVideo ? theaterVideo.volume : 1);
        const newVol = Math.max(0, curVol - 0.1);
        if (theaterVideo) {
          theaterVideo.volume = newVol;
          if (!isAudioFallbackActive) theaterVideo.muted = (newVol === 0);
        }
        if (theaterAudio) {
          theaterAudio.volume = newVol;
          theaterAudio.muted = (newVol === 0);
        }
        if (theaterVolSlider) theaterVolSlider.value = String(newVol);
        if (theaterVolIcon) theaterVolIcon.innerHTML = `<use href="#${newVol === 0 ? 'i-volume-x' : 'i-volume'}"/>`;
        resetHudHideTimer();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (theaterVolBtn) theaterVolBtn.click();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (theaterFsBtn) theaterFsBtn.click();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        if (theaterVlcBtn) theaterVlcBtn.click();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        cycleSubtitles();
      }
    }
  });

  // Play in external standalone VLC window
  async function playInExternalVlc(videoId) {
    try {
      showToast('Opening in VLC...');
      const res = await window.mediavault.openInVlc(videoId);
      if (res && res.error) {
        showToast('Error opening: ' + res.error);
      } else {
        showToast('Playing in VLC');
        loadLibrary();
      }
    } catch (e) {
      showToast('Could not launch video');
    }
  }

  // Detail Panel Actions
  if (posterPlay) {
    posterPlay.addEventListener('click', () => {
      if (state.selectedId) {
        const v = state.videos.find((x) => x.id === state.selectedId);
        if (v) openTheaterPlayer(v);
      }
    });
  }
  if (btnOpenVlc) {
    btnOpenVlc.addEventListener('click', () => {
      if (state.selectedId) {
        const v = state.videos.find((x) => x.id === state.selectedId);
        if (v) openTheaterPlayer(v);
      }
    });
  }

  if (btnCopyPath) {
    btnCopyPath.addEventListener('click', async () => {
      const v = state.videos.find((x) => x.id === state.selectedId);
      if (v && v.file_path) {
        await window.mediavault.copyPath(v.file_path);
        showToast('Path copied to clipboard');
      }
    });
  }

  if (btnShowFolder) {
    btnShowFolder.addEventListener('click', async () => {
      const v = state.videos.find((x) => x.id === state.selectedId);
      if (v && v.file_path) {
        await window.mediavault.showInFolder(v.file_path);
        showToast('Revealed in Explorer');
      }
    });
  }

  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', () => {
      appEl.classList.remove('has-panel');
    });
  }

  if (posterEl) {
    posterEl.addEventListener('contextmenu', (e) => {
      if (state.selectedId) {
        const v = state.videos.find((x) => x.id === state.selectedId);
        if (v) openContextMenu(e, v);
      }
    });
  }

  // ═══════════ Sleek Apple Liquid Glass Context Menu ═══════════
  function openContextMenu(e, video) {
    if (!video || !contextMenu) return;
    e.preventDefault();
    e.stopPropagation();

    activeContextVideo = video;

    // Dynamic labels
    if (ctxFavLabel) ctxFavLabel.textContent = video.is_favorite ? 'Remove Favorite' : 'Add to Favorites';
    if (ctxWatchlaterLabel) ctxWatchlaterLabel.textContent = video.is_watch_later ? 'Remove Watch Later' : 'Watch Later';
    if (ctxCompletedLabel) ctxCompletedLabel.textContent = video.is_completed ? 'Mark as Unwatched' : 'Mark as Watched';

    // Position menu safely within viewport boundaries
    contextMenu.style.display = 'block';
    const menuWidth = 222;
    const menuHeight = 295;
    const pad = 12;

    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth - pad) {
      posX = window.innerWidth - menuWidth - pad;
    }
    if (posY + menuHeight > window.innerHeight - pad) {
      posY = window.innerHeight - menuHeight - pad;
    }

    contextMenu.style.left = `${Math.max(pad, posX)}px`;
    contextMenu.style.top = `${Math.max(pad, posY)}px`;
    contextMenu.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      contextMenu.classList.add('is-visible');
    });

    if (window.LumenGlass && window.LumenGlass.schedule) {
      window.LumenGlass.schedule(contextMenu);
    }
  }

  function closeContextMenu() {
    if (!contextMenu || contextMenu.style.display === 'none') return;
    contextMenu.classList.remove('is-visible');
    contextMenu.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (!contextMenu.classList.contains('is-visible')) {
        contextMenu.style.display = 'none';
        activeContextVideo = null;
      }
    }, 120);
  }

  window.addEventListener('click', (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) {
      closeContextMenu();
    }
  });

  window.addEventListener('contextmenu', (e) => {
    // If right-clicking anywhere other than a media card, row, poster or the menu itself, dismiss context menu
    if (contextMenu && !e.target.closest('.card') && !e.target.closest('.series-ep-row') && !e.target.closest('#poster') && !e.target.closest('#context-menu')) {
      closeContextMenu();
    }
  });

  async function performDeleteVideo(video) {
    if (!video) return;
    closeContextMenu();

    const videoId = video.id;
    const filename = video.filename;

    // Immediately animate card or episode row collapse
    const matchingElements = document.querySelectorAll(`[data-id="${videoId}"]`);
    matchingElements.forEach((el) => el.classList.add('is-deleting'));

    try {
      const res = await window.mediavault.deleteVideo(videoId);
      if (res && res.success) {
        showToast(`Moved to Trash: ${cleanTitle(filename)}`);

        // If currently playing in player, close player
        if (theaterModal && theaterModal.classList.contains('is-open')) {
          if (currentPlayingVideo && currentPlayingVideo.id === videoId) {
            closeTheaterPlayer();
          }
        }

        // If currently inspected in details panel, close panel
        if (state.selectedId === videoId) {
          state.selectedId = null;
          appEl.classList.remove('has-panel');
        }

        // Remove from memory
        state.videos = state.videos.filter((v) => v.id !== videoId);
        state.allVideos = state.allVideos.filter((v) => v.id !== videoId);

        if (res.counts) {
          state.counts = res.counts;
          updateSidebarCounts();
        }

        setTimeout(() => {
          matchingElements.forEach((el) => el.remove());
          // In TV series view, clean up empty series blocks
          document.querySelectorAll('.series-block').forEach((block) => {
            const list = block.querySelector('.series-episodes-list');
            if (list && list.children.length === 0) {
              block.remove();
            }
          });
          if (state.videos.length === 0) {
            emptyStateEl.style.display = 'flex';
          }
        }, 240);
      } else {
        matchingElements.forEach((el) => el.classList.remove('is-deleting'));
        showToast(`Could not delete: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      matchingElements.forEach((el) => el.classList.remove('is-deleting'));
      showToast(`Delete error: ${err.message}`);
    }
  }

  // Context Menu Item Action Handlers
  if (ctxPlay) {
    ctxPlay.addEventListener('click', () => {
      if (!activeContextVideo) return;
      const v = activeContextVideo;
      closeContextMenu();
      selectVideo(v, true);
      openTheaterPlayer(v);
    });
  }

  if (ctxVlc) {
    ctxVlc.addEventListener('click', async () => {
      if (!activeContextVideo) return;
      const v = activeContextVideo;
      closeContextMenu();
      showToast(`Launching VLC: ${cleanTitle(v.filename)}`);
      await window.mediavault.openInVlc(v.id);
    });
  }

  if (ctxFolder) {
    ctxFolder.addEventListener('click', async () => {
      if (!activeContextVideo) return;
      const v = activeContextVideo;
      closeContextMenu();
      await window.mediavault.showInFolder(v.file_path);
      showToast('Revealed in Explorer');
    });
  }

  if (ctxCopy) {
    ctxCopy.addEventListener('click', async () => {
      if (!activeContextVideo) return;
      const v = activeContextVideo;
      closeContextMenu();
      await window.mediavault.copyPath(v.file_path);
      showToast('Full path copied to clipboard');
    });
  }

  if (ctxFav) {
    ctxFav.addEventListener('click', async () => {
      if (!activeContextVideo) return;
      const v = activeContextVideo;
      closeContextMenu();
      const res = await window.mediavault.toggleFavorite(v.id);
      v.is_favorite = res.is_favorite;
      state.counts = res.counts;
      updateSidebarCounts();

      const card = document.querySelector(`.card[data-id="${v.id}"]`);
      if (card) {
        const favEl = card.querySelector('.fav');
        if (res.is_favorite && !favEl) {
          const thumb = card.querySelector('.thumb');
          if (thumb) {
            const s = document.createElement('span');
            s.className = 'fav';
            s.innerHTML = '<svg class="icon icon--sm"><use href="#i-star-fill"/></svg>';
            thumb.appendChild(s);
          }
        } else if (!res.is_favorite && favEl) {
          favEl.remove();
        }
      }
      showToast(res.is_favorite ? 'Added to Favorites' : 'Removed from Favorites');
    });
  }

  if (ctxWatchlater) {
    ctxWatchlater.addEventListener('click', async () => {
      if (!activeContextVideo) return;
      const v = activeContextVideo;
      closeContextMenu();
      const res = await window.mediavault.toggleWatchLater(v.id);
      v.is_watch_later = res.is_watch_later;
      state.counts = res.counts;
      updateSidebarCounts();
      showToast(res.is_watch_later ? 'Added to Watch Later' : 'Removed from Watch Later');
    });
  }

  if (ctxCompleted) {
    ctxCompleted.addEventListener('click', async () => {
      if (!activeContextVideo) return;
      const v = activeContextVideo;
      closeContextMenu();
      const res = await window.mediavault.toggleCompleted(v.id);
      v.is_completed = res.is_completed;
      state.counts = res.counts;
      updateSidebarCounts();
      showToast(res.is_completed ? 'Marked as Watched' : 'Marked as Unwatched');
    });
  }

  if (ctxDelete) {
    ctxDelete.addEventListener('click', () => {
      if (!activeContextVideo) return;
      const v = activeContextVideo;
      performDeleteVideo(v);
    });
  }

  // Sidebar Navigation Filters
  document.querySelectorAll('.sidebar .nav-item[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar .nav-item.is-selected').forEach((x) => x.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      state.filter = btn.dataset.filter;
      loadLibrary();
    });
  });

  // Search Input with Debounce
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      loadLibrary();
    }, 160);
  });

  // Sort Dropdown
  sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    loadLibrary();
  });

  // View Switcher (Grid, Dense, List)
  viewSwitcher.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      viewSwitcher.querySelectorAll('button').forEach((x) => x.classList.remove('is-on'));
      b.classList.add('is-on');
      state.view = b.dataset.view;
      renderGrid();
    });
  });

  // Refresh Button
  btnRefresh.addEventListener('click', () => {
    showToast('Refreshing library...');
    loadLibrary();
  });

  // Scan Button Trigger
  btnScan.addEventListener('click', async () => {
    if (state.isScanning) return;
    state.isScanning = true;
    scanBar.classList.add('is-visible');
    scanBarText.textContent = 'Scanning media folders...';
    scanBarFill.style.width = '10%';
    try {
      await window.mediavault.startScan();
    } catch (err) {
      showToast('Scan error: ' + err.message);
      scanBar.classList.remove('is-visible');
      state.isScanning = false;
    }
  });

  // Scan Real-Time Events
  if (window.mediavault.onScanProgress) {
    window.mediavault.onScanProgress((data) => {
      scanBar.classList.add('is-visible');
      if (data.phase === 'crawling') {
        scanBarText.textContent = data.file || 'Scanning folders...';
        scanBarFill.style.width = '25%';
      } else if (data.phase === 'processing') {
        const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 50;
        scanBarText.textContent = `Analyzing ${data.current} of ${data.total}: ${data.file}`;
        scanBarFill.style.width = `${pct}%`;
      }
    });

    window.mediavault.onScanCompleted((data) => {
      scanBarFill.style.width = '100%';
      scanBarText.textContent = `Scan complete · ${data.totalScanned || 0} videos`;
      setTimeout(() => {
        scanBar.classList.remove('is-visible');
        state.isScanning = false;
        scanNote.textContent = 'Last scan just now';
        showToast('Library scan complete');
        loadLibrary();
      }, 1200);
    });

    window.mediavault.onScanError((data) => {
      scanBar.classList.remove('is-visible');
      state.isScanning = false;
      showToast('Scan error: ' + data.message);
    });
  }

  // Modals Controller
  function openModal(modal) {
    modal.classList.add('is-open');
  }

  function closeModal(modal) {
    modal.classList.remove('is-open');
  }

  document.querySelectorAll('.modal-close, .modal-backdrop').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('.modal-close')) {
        closeModal(el.closest('.modal-backdrop'));
      }
    });
  });

  // Settings Modal
  btnSettingsTrigger.addEventListener('click', async () => {
    const [folders, settings] = await Promise.all([
      window.mediavault.getScanFolders(),
      window.mediavault.getSettings()
    ]);
    renderModalFolders(folders);

    const minDurInput = document.getElementById('setting-min-dur');
    const minDurLabel = document.getElementById('setting-min-dur-label');
    const curMin = parseInt(settings.min_duration || '0', 10);
    minDurInput.value = curMin;
    minDurLabel.textContent = `${curMin}s`;

    const autoscanSelect = document.getElementById('setting-autoscan-interval');
    if (autoscanSelect) {
      autoscanSelect.value = settings.autoscan_interval || '360';
    }

    const lastScanDesc = document.getElementById('setting-last-scan-desc');
    if (lastScanDesc) {
      const lastScanTime = parseInt(settings.last_scan_time || '0', 10);
      lastScanDesc.textContent = lastScanTime > 0
        ? `Last full scan: ${formatRelativeTime(lastScanTime)}`
        : 'Crawls all folders and extracts missing thumbnails';
    }

    openModal(settingsModal);
  });

  const autoscanSelect = document.getElementById('setting-autoscan-interval');
  if (autoscanSelect) {
    autoscanSelect.addEventListener('change', async (e) => {
      await window.mediavault.saveSetting('autoscan_interval', e.target.value);
      showToast(`Autoscan interval set: ${autoscanSelect.options[autoscanSelect.selectedIndex].text}`);
    });
  }

  function renderModalFolders(folders) {
    const list = document.getElementById('modal-folder-list');
    list.innerHTML = '';

    if (!folders || folders.length === 0) {
      list.innerHTML = '<p class="t-caption" style="padding:8px 0;">No library folders configured. Add one below.</p>';
      return;
    }

    for (const f of folders) {
      const item = document.createElement('div');
      item.className = 'folder-item';

      const info = document.createElement('div');
      info.className = 'folder-info';

      const pathSpan = document.createElement('span');
      pathSpan.className = 'folder-path';
      pathSpan.textContent = f.folder_path;
      info.appendChild(pathSpan);

      const badge = document.createElement('span');
      badge.className = 'folder-badge';
      badge.textContent = `${f.video_count || 0} media files indexed`;
      info.appendChild(badge);

      item.appendChild(info);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon';
      delBtn.title = 'Remove folder';
      delBtn.innerHTML = '<svg class="icon icon--sm" style="color:var(--text-3);"><use href="#i-trash"/></svg>';
      delBtn.addEventListener('click', async () => {
        const updated = await window.mediavault.removeScanFolder(f.id);
        renderModalFolders(updated);
        loadLibrary();
      });

      item.appendChild(delBtn);
      list.appendChild(item);
    }
  }

  document.getElementById('btn-add-folder').addEventListener('click', async () => {
    const res = await window.mediavault.addScanFolder();
    if (res && res.added) {
      renderModalFolders(res.folders);
      showToast(`Added folder: ${res.folder}`);
      loadLibrary();
    }
  });

  const minDurInput = document.getElementById('setting-min-dur');
  const minDurLabel = document.getElementById('setting-min-dur-label');
  minDurInput.addEventListener('input', (e) => {
    minDurLabel.textContent = `${e.target.value}s`;
  });
  minDurInput.addEventListener('change', async (e) => {
    await window.mediavault.saveSetting('min_duration', e.target.value);
    showToast(`Minimum duration set to ${e.target.value}s`);
    loadLibrary();
  });

  document.getElementById('btn-modal-rescan').addEventListener('click', () => {
    closeModal(settingsModal);
    btnScan.click();
  });

  // Statistics Modal
  btnStatsTrigger.addEventListener('click', async () => {
    const stats = await window.mediavault.getStats();

    document.getElementById('stat-total-vids').textContent = stats.totalVideos || 0;
    document.getElementById('stat-total-dur').textContent = formatDuration(stats.totalDuration);
    document.getElementById('stat-total-size').textContent = formatBytes(stats.totalSize);
    document.getElementById('stat-watched').textContent = `${stats.watchedCount || 0} / ${stats.totalVideos || 0}`;

    // Resolutions List
    const resList = document.getElementById('stat-resolutions');
    resList.innerHTML = '';
    for (const r of stats.resolutions || []) {
      const row = document.createElement('div');
      row.className = 'folder-item';
      row.innerHTML = `
        <span style="font-weight:600; color:#fff;">${r.res_group}</span>
        <span class="folder-badge" style="font-size:13px; color:var(--accent); font-weight:600;">${r.count} videos</span>
      `;
      resList.appendChild(row);
    }

    // Codecs List
    const codecList = document.getElementById('stat-codecs');
    codecList.innerHTML = '';
    for (const c of stats.codecs || []) {
      const row = document.createElement('div');
      row.className = 'folder-item';
      row.innerHTML = `
        <span style="font-weight:600; color:#fff;">${c.codec_name.toUpperCase()}</span>
        <span class="folder-badge" style="font-size:13px; color:var(--accent); font-weight:600;">${c.count} videos</span>
      `;
      codecList.appendChild(row);
    }

    openModal(statsModal);
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl+K or Cmd+K: Focus Search
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    // Escape: Close Modals, Context Menu, or Detail Panel
    if (e.key === 'Escape') {
      if (contextMenu && contextMenu.classList.contains('is-visible')) {
        closeContextMenu();
        return;
      }
      if (document.querySelector('.modal-backdrop.is-open')) {
        document.querySelectorAll('.modal-backdrop.is-open').forEach(closeModal);
      } else if (appEl.classList.contains('has-panel')) {
        appEl.classList.remove('has-panel');
      }
    }
  });

  function formatRelativeTime(timestampSec) {
    if (!timestampSec || timestampSec <= 0) return 'never';
    const diffSec = Math.floor(Date.now() / 1000) - timestampSec;
    if (diffSec < 45) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  async function checkPeriodicAutoscan(force = false) {
    try {
      if (window.mediavault.checkAutoscan) {
        const res = await window.mediavault.checkAutoscan(force);
        if (res && res.lastScan) {
          scanNote.textContent = `Last scan ${formatRelativeTime(res.lastScan)}`;
        }
      }
      if (window.mediavault.getLastScanTime) {
        const info = await window.mediavault.getLastScanTime();
        if (info && info.lastScanTime > 0) {
          scanNote.textContent = `Last scan ${formatRelativeTime(info.lastScanTime)}`;
        }
      }
    } catch (e) {}
  }

  // ── Apple Fluid Momentum & Rubber-band Bouncy Scrolling ──
  function setupBouncyScrolling(scrollContainer, scrollContent) {
    if (!scrollContainer || !scrollContent) return;

    let currentY = 0;
    let targetY = 0;
    let springVelocity = 0;
    let animFrame = null;
    let wheelEndTimer = null;

    // Apple rubber-band physics: (overshoot * dimension * constant) / (dimension + constant * |overshoot|)
    function rubberband(overshoot, dimension, constant = 0.55) {
      return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
    }

    function updateSpring() {
      // Damped spring physics: F = -k * x - c * v
      const k = 0.14; // stiffness
      const c = 0.72; // damping (Apple snappy settle)
      
      const force = -k * currentY - c * springVelocity;
      springVelocity += force;
      currentY += springVelocity;

      if (Math.abs(currentY) < 0.15 && Math.abs(springVelocity) < 0.15) {
        currentY = 0;
        springVelocity = 0;
        scrollContent.style.transform = '';
        animFrame = null;
        return;
      }

      scrollContent.style.transform = `translate3d(0, ${currentY.toFixed(2)}px, 0)`;
      animFrame = requestAnimationFrame(updateSpring);
    }

    scrollContainer.addEventListener('wheel', (e) => {
      const scrollTop = scrollContainer.scrollTop;
      const maxScroll = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      const deltaY = e.deltaY;

      const isAtTop = scrollTop <= 0 && deltaY < 0;
      const isAtBottom = scrollTop >= (maxScroll - 1) && deltaY > 0;

      if (isAtTop || isAtBottom || currentY !== 0) {
        e.preventDefault();
        if (animFrame) {
          cancelAnimationFrame(animFrame);
          animFrame = null;
        }

        targetY -= deltaY * 0.45;
        const containerHeight = scrollContainer.clientHeight || 600;
        currentY = rubberband(targetY, containerHeight, 0.55);
        scrollContent.style.transform = `translate3d(0, ${currentY.toFixed(2)}px, 0)`;

        clearTimeout(wheelEndTimer);
        wheelEndTimer = setTimeout(() => {
          targetY = 0;
          springVelocity = 0;
          if (!animFrame) animFrame = requestAnimationFrame(updateSpring);
        }, 100);
      }
    }, { passive: false });
  }

  // Setup Bouncy Scrolling on main library grid
  setupBouncyScrolling(
    document.getElementById('scroll-container'),
    document.getElementById('scroll-content')
  );

  // Periodic autoscan handler
  async function checkPeriodicAutoscan(force = false) {
    try {
      if (window.mediavault && window.mediavault.checkAutoscan) {
        await window.mediavault.checkAutoscan(force);
      }
    } catch (e) {
      console.warn('Autoscan check skipped:', e);
    }
  }

  // Initial Load
  loadLibrary();
  setTimeout(() => checkPeriodicAutoscan(false), 3000);
  setInterval(() => checkPeriodicAutoscan(false), 15 * 60 * 1000);

})();
