'use strict';
(() => {
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const photos = Array.isArray(window.LOVE_PHOTOS) ? window.LOVE_PHOTOS : [];
  const audio = $('#our-audio');
  const intro = $('#intro');
  const mainPlay = $('#main-play');
  const mainIcon = $('#main-play-icon');
  const floatPlay = $('#float-play');
  const floating = $('#floating-player');
  const headerMusic = $('#header-music');
  const seek = $('#seek');
  const volume = $('#volume');
  let playerClosed = false;
  let currentFilter = 'all';
  let galleryVisible = 16;
  let lightboxIndex = -1;
  let previousFocus = null;

  // Calm scroll animations; readable even if animation is disabled.
  const revealItems = $$('.reveal');
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px 55px 0px' });
    revealItems.forEach(item => observer.observe(item));
  } else revealItems.forEach(item => item.classList.add('visible'));

  // Music player: the user's MP3 is included locally in the site, no server required.
  audio.volume = .65;
  function formatTime(value) {
    if (!Number.isFinite(value) || value < 0) return '0:00';
    const sec = Math.floor(value);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2,'0')}`;
  }
  function isPlaying() { return !audio.paused && !audio.ended; }
  function refreshPlayer() {
    const playing = isPlaying();
    document.body.classList.toggle('is-playing', playing);
    mainIcon.textContent = playing ? '❚❚' : '▶';
    floatPlay.textContent = playing ? '❚❚' : '▶';
    floatPlay.setAttribute('aria-label', playing ? 'Поставить песню на паузу' : 'Воспроизвести песню');
    mainPlay.setAttribute('aria-label', playing ? 'Поставить песню на паузу' : 'Воспроизвести песню');
    headerMusic.setAttribute('aria-label', playing ? 'Приостановить песню' : 'Включить песню');
    headerMusic.setAttribute('aria-pressed', String(playing));
    $('#header-music-label').textContent = playing ? 'пауза' : 'песня';
    $('#audio-status').textContent = playing ? 'Звучит наша песня ♡' : 'Включи нашу песню ♡';
    if ((audio.currentTime > 0 || playing) && !playerClosed) floating.classList.add('shown');
  }
  async function playSong() {
    $$('video').forEach(video => { if (!video.paused) video.pause(); });
    try {
      playerClosed = false;
      await audio.play();
      floating.classList.add('shown');
    } catch (error) {
      $('#audio-status').textContent = 'Не получилось включить песню. Нажми ▶ ещё раз.';
    }
    refreshPlayer();
  }
  function toggleSong() { if (isPlaying()) audio.pause(); else playSong(); }
  [mainPlay,floatPlay,headerMusic].forEach(button => button.addEventListener('click', toggleSong));
  $('#rewind').addEventListener('click', () => audio.currentTime = Math.max(0,audio.currentTime-10));
  $('#forward').addEventListener('click', () => audio.currentTime = Math.min(Number.isFinite(audio.duration) ? audio.duration : audio.currentTime+10, audio.currentTime+10));
  $('#float-close').addEventListener('click', () => { playerClosed = true; floating.classList.remove('shown'); });
  function updateProgress() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const value = duration > 0 ? audio.currentTime / duration : 0;
    seek.value = String(Math.round(value*1000));
    seek.style.setProperty('--played',`${(value*100).toFixed(2)}%`);
    $('#floating-progress-fill').style.width = `${(value*100).toFixed(2)}%`;
    $('#time-current').textContent = formatTime(audio.currentTime);
    $('#time-total').textContent = formatTime(duration);
  }
  audio.addEventListener('loadedmetadata',updateProgress);
  audio.addEventListener('durationchange',updateProgress);
  audio.addEventListener('timeupdate',updateProgress);
  audio.addEventListener('play',refreshPlayer);
  audio.addEventListener('pause',refreshPlayer);
  audio.addEventListener('ended',refreshPlayer);
  audio.addEventListener('error',() => { $('#audio-status').textContent='Не удаётся открыть файл песни.'; });
  seek.addEventListener('input', () => {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = (Number(seek.value)/1000)*audio.duration;
    updateProgress();
  });
  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value)/100;
    volume.style.setProperty('--played',`${volume.value}%`);
  });
  volume.style.setProperty('--played',`${volume.value}%`);
  $$('video').forEach(video => video.addEventListener('play',() => {
    if (isPlaying()) audio.pause();
    $$('video').forEach(other => { if (other !== video && !other.paused) other.pause(); });
  }));

  // Intro: sound starts only after a real user click (browser autoplay policy).
  document.body.classList.add('modal-open');
  function closeIntro(withSong) {
    intro.classList.add('is-gone');
    document.body.classList.remove('modal-open');
    if (withSong) playSong();
    window.setTimeout(() => { intro.hidden = true; }, 880);
    $('#main-play').focus({ preventScroll: true });
  }
  $('#enter-music').addEventListener('click',() => closeIntro(true));
  $('#enter-silent').addEventListener('click',() => closeIntro(false));
  $('#enter-music').focus({preventScroll:true});

  // Full photo album: pre-compressed thumbnails, lazy-loaded in small batches.
  // Unique hand-written captions for every photo, preserving descriptions when filtering.
  const filteredPhotos = () => photos.filter(p => currentFilter === 'all' || p.type === currentFilter);
  function captionFor(photo) { return photo.title || 'Наше мгновение'; }
  function descriptionFor(photo) { return photo.description || ''; }
  function buildPhotoCard(photo, index) {
    const figure = document.createElement('figure');
    figure.className = 'photo-card';
    figure.tabIndex = 0;
    figure.setAttribute('role','button');
    figure.setAttribute('aria-label',`Открыть фото ${index + 1}. ${captionFor(photo)}`);
    const img = document.createElement('img');
    img.src = photo.thumb;
    img.alt = photo.alt;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = photo.w;
    img.height = photo.h;
    const figcaption = document.createElement('figcaption');
    const title = document.createElement('strong');
    title.className = 'photo-card-title';
    title.textContent = captionFor(photo);
    const note = document.createElement('span');
    note.className = 'photo-card-note';
    note.textContent = descriptionFor(photo);
    figcaption.append(title, note);
    figure.append(img,figcaption);
    figure.addEventListener('click',() => openPhoto(index));
    figure.addEventListener('keydown',event => {
      if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();openPhoto(index);}
    });
    return figure;
  }
  function renderGallery() {
    const current = filteredPhotos();
    const grid = $('#photo-grid');
    grid.replaceChildren();
    const subset = current.slice(0,galleryVisible);
    const fragment = document.createDocumentFragment();
    subset.forEach((photo,i) => fragment.append(buildPhotoCard(photo,i)));
    grid.append(fragment);
    $('#gallery-count').textContent = `Показано ${subset.length} из ${current.length} фотографий`;
    $('#more-photos').hidden = subset.length >= current.length;
  }
  $('#count-all').textContent = photos.length;
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    currentFilter = tab.dataset.filter;
    galleryVisible = 16;
    $$('.tab').forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    renderGallery();
  }));
  $('#more-photos').addEventListener('click', () => {galleryVisible += 16; renderGallery(); });
  renderGallery();

  // Accessible fullscreen photo viewer with arrow keys and touch gestures.
  const lightbox = $('#lightbox');
  const letter = $('#letter-modal');
  let touchStartX = null;
  function lockForModal() { document.body.classList.add('modal-open'); }
  function unlockForModal() { if (lightbox.hidden && letter.hidden) document.body.classList.remove('modal-open'); }
  function paintPhoto() {
    const current = filteredPhotos();
    if (!current.length) return;
    lightboxIndex = (lightboxIndex + current.length) % current.length;
    const entry = current[lightboxIndex];
    $('#lightbox-img').src = entry.src;
    $('#lightbox-img').alt = entry.alt;
    const caption = $('#lightbox-caption');
    const number = document.createElement('span');
    number.className = 'lightbox-number';
    number.textContent = `${String(lightboxIndex + 1).padStart(2,'0')} / ${String(current.length).padStart(2,'0')}`;
    const title = document.createElement('strong');
    title.className = 'lightbox-title';
    title.textContent = captionFor(entry);
    const note = document.createElement('span');
    note.className = 'lightbox-note';
    note.textContent = descriptionFor(entry);
    caption.replaceChildren(number, title, note);
  }
  function openPhoto(index) {
    previousFocus = document.activeElement;
    lightboxIndex = index;
    paintPhoto();
    lightbox.hidden = false;
    lockForModal();
    $('.overlay-close',lightbox).focus();
  }
  function closePhoto() {
    lightbox.hidden = true;
    $('#lightbox-img').removeAttribute('src');
    unlockForModal();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }
  $('#lightbox-prev').addEventListener('click', () => {lightboxIndex--;paintPhoto();});
  $('#lightbox-next').addEventListener('click', () => {lightboxIndex++;paintPhoto();});
  lightbox.addEventListener('touchstart',event => {touchStartX = event.changedTouches[0].screenX;}, {passive:true});
  lightbox.addEventListener('touchend',event => {
    if (touchStartX === null) return;
    const dx=event.changedTouches[0].screenX-touchStartX;
    if (Math.abs(dx)>55) {lightboxIndex += dx < 0 ? 1 : -1;paintPhoto();}
    touchStartX=null;
  }, {passive:true});
  function openLetter() {
    previousFocus = document.activeElement;
    letter.hidden = false;
    lockForModal();
    letter.querySelector('.modal-close').focus();
  }
  function closeLetter() {
    letter.hidden = true;
    unlockForModal();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }
  $$('.open-letter').forEach(button => button.addEventListener('click',openLetter));
  $$('[data-close]').forEach(el => el.addEventListener('click', () => {
    if (el.dataset.close === 'lightbox') closePhoto();
    else closeLetter();
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!lightbox.hidden) closePhoto();
      else if (!letter.hidden) closeLetter();
    }
    if (!lightbox.hidden && event.key === 'ArrowRight') {lightboxIndex++;paintPhoto();}
    if (!lightbox.hidden && event.key === 'ArrowLeft') {lightboxIndex--;paintPhoto();}
    const activeModal = !lightbox.hidden ? lightbox : !letter.hidden ? letter : null;
    if (activeModal && event.key === 'Tab') {
      const focusable = $$('button:not([disabled])',activeModal).filter(el => !el.hidden);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
    }
  });

  // A tiny gift: short, original compliments. Never repeat the last one.
  const reasons = [
    'Ты умеешь делать обычные минуты особенными.',
    'Мне нравится, как ты улыбаешься, когда тебе хорошо.',
    'В тебе есть нежность, которую не передать словами.',
    'Ты настоящая — и именно это бесценно.',
    'С тобой даже тишина может быть уютной.',
    'Ты можешь быть разной, и каждая твоя сторона важна.',
    'Мне хочется слушать тебя и узнавать всё лучше.',
    'Твои глаза рассказывают больше, чем сотни сообщений.',
    'Я рад, что в моей жизни есть твоя история.',
    'Ты не обязана быть идеальной, чтобы быть любимой.',
    'Твои маленькие привычки делают тебя неповторимой.',
    'Мне хочется беречь моменты, в которых мы счастливы.',
    'Ты — целая вселенная, которую интересно открывать.',
    'Спасибо тебе за тепло, которое ты даришь.',
    'Я выбираю не красивую сказку, а настоящую тебя.'
  ];
  let reasonIndex = 0;
  $('#reason-button').addEventListener('click', () => {
    let next = reasonIndex;
    while (next === reasonIndex) next = Math.floor(Math.random()*reasons.length);
    reasonIndex = next;
    $('#reason-text').textContent = reasons[reasonIndex];
    showerHearts(13);
  });

  function showerHearts(quantity=36) {
    if (reducedMotion) return;
    const root = $('#hearts');
    for (let i=0;i<quantity;i++) {
      const span=document.createElement('span');
      span.className='fly-heart';
      span.textContent=['♥','♡','✦','❤'][i%4];
      span.style.left=`${Math.random()*100}%`;
      span.style.setProperty('--dx',`${(Math.random()-.5)*175}px`);
      span.style.setProperty('--dur',`${3+Math.random()*2.3}s`);
      span.style.animationDelay=`${Math.random()*.6}s`;
      span.style.fontSize=`${13+Math.random()*25}px`;
      root.append(span);
      span.addEventListener('animationend', () => span.remove(), {once:true});
    }
  }
  $('#hearts-button').addEventListener('click',() => showerHearts(46));
  $('#letter-hearts').addEventListener('click', () => {closeLetter(); showerHearts(55);});

  // Mobile navigation and top-of-page progress.
  const menuToggle = $('#menu-toggle');
  const mobileMenu = $('#mobile-menu');
  menuToggle.addEventListener('click', () => {
    const next = mobileMenu.hidden;
    mobileMenu.hidden = !next;
    menuToggle.setAttribute('aria-expanded',String(next));
    menuToggle.setAttribute('aria-label',next ? 'Закрыть меню' : 'Открыть меню');
  });
  $$('.mobile-menu a').forEach(link => link.addEventListener('click', () => {
    mobileMenu.hidden=true;
    menuToggle.setAttribute('aria-expanded','false');
  }));
  let scrollFrame=false;
  function readProgress() {
    const height=document.documentElement.scrollHeight-window.innerHeight;
    $('#reading-progress').style.width = `${height > 0 ? window.scrollY/height*100 : 0}%`;
    scrollFrame=false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollFrame) {scrollFrame=true;window.requestAnimationFrame(readProgress);}
  }, {passive:true});
  readProgress();
  $('#copyright-year').textContent = `${new Date().getFullYear()} ♡`;
})();
