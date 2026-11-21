AFRAME.registerComponent('auto-fit-model', {
  init() {
    this.el.addEventListener('model-loaded', () => {
      const object = this.el.getObject3D('mesh');
      if (!object) return;
      // Replace Unity's untextured video Quad with the sibling a-video surface.
      // Omit Vuforia's preview so neither plane distorts the building's bounds.
      const helpers = [];
      object.traverse((node) => {
        if (node.name === 'ImageTargetPreviewRoot' || /^Quad(?:[ _]\(\d+\))?$/.test(node.name)) helpers.push(node);
      });
      helpers.forEach((node) => node.removeFromParent());
      // Measure the asset without the tracked target's world scale/position.
      // Cloning the hierarchy shares geometry/materials, without copying GPU data.
      const box = new AFRAME.THREE.Box3().setFromObject(object.clone(true), true);
      const size = box.getSize(new AFRAME.THREE.Vector3());
      const center = box.getCenter(new AFRAME.THREE.Vector3());
      const scalar = 0.60 / Math.max(size.x, size.y, size.z, 0.001);
      this.el.object3D.scale.setScalar(scalar);
      this.el.object3D.position.set(-0.34 - center.x * scalar, -center.y * scalar, 0.08 - center.z * scalar);
      this.el.dataset.ready = 'true';
      this.el.dispatchEvent(new CustomEvent('model-ready', { bubbles: true }));
    });
  }
});

const scene = document.querySelector('#ar-scene');
const welcome = document.querySelector('#welcome');
const arUi = document.querySelector('#ar-ui');
const startButton = document.querySelector('#start-button');
const status = document.querySelector('#status');
const targetName = document.querySelector('#target-name');
const targetNumber = document.querySelector('#target-number');
const targetDetail = document.querySelector('#target-detail');
const helpDialog = document.querySelector('#help-dialog');
const videoControls = document.querySelector('#video-controls');
const videoStatus = document.querySelector('#video-status');
const playVideoButton = document.querySelector('#play-video');
const muteVideoButton = document.querySelector('#mute-video');
const targetMedia = new Map();
let arState = 'idle';
let activeTarget = null;

const syncVideoControls = () => {
  videoControls.hidden = !activeTarget;
  if (!activeTarget) return;
  const { video } = targetMedia.get(activeTarget);
  playVideoButton.textContent = video.paused ? '播放视频' : '暂停视频';
  muteVideoButton.textContent = video.muted ? '打开声音' : '静音';
};

const playTargetVideo = async (target) => {
  const { video } = targetMedia.get(target);
  try {
    await video.play();
    if (activeTarget !== target || document.hidden) video.pause();
  } catch (error) {
    if (activeTarget === target && error.name !== 'AbortError') {
      videoStatus.textContent = video.error ? '视频加载失败，请点击播放重试' : '点击“播放视频”开始播放';
    }
  }
  syncVideoControls();
};

playVideoButton.addEventListener('click', () => {
  if (!activeTarget) return;
  const media = targetMedia.get(activeTarget);
  media.userPaused = !media.video.paused;
  if (media.userPaused) media.video.pause();
  else {
    if (media.video.error) media.video.load();
    playTargetVideo(activeTarget);
  }
});
muteVideoButton.addEventListener('click', () => {
  if (!activeTarget) return;
  const media = targetMedia.get(activeTarget);
  media.video.muted = !media.video.muted;
  syncVideoControls();
  if (!media.userPaused) playTargetVideo(activeTarget);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) targetMedia.forEach(({ video }) => video.pause());
  else if (activeTarget && !targetMedia.get(activeTarget).userPaused) playTargetVideo(activeTarget);
});
window.addEventListener('pagehide', () => targetMedia.forEach(({ video }) => video.pause()));

const showStartError = (error) => {
  arState = 'idle';
  const video = scene.systems['mindar-image-system']?.video;
  video?.srcObject?.getTracks().forEach((track) => track.stop());
  video?.remove();
  welcome.hidden = false;
  arUi.hidden = true;
  startButton.disabled = false;
  startButton.textContent = '重新尝试';
  document.querySelector('.intro').textContent = '无法启动摄像头或 AR。请使用 HTTPS 或 localhost，允许摄像头权限，并确认摄像头未被其他应用占用。';
  console.error(error);
};

// MindAR 1.2.5 start() returns immediately; readiness and camera errors are events.
scene.addEventListener('arReady', () => {
  if (arState !== 'starting') return;
  arState = 'running';
  status.textContent = '请对准任意一张目标图';
});
scene.addEventListener('arError', (event) => showStartError(event.detail));

const startAr = async () => {
  if (location.protocol === 'file:') return;
  if (arState !== 'idle') return;
  arState = 'starting';
  startButton.disabled = true;
  startButton.textContent = '正在启动…';
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access requires HTTPS or localhost and getUserMedia support.');
    }
    if (!scene.hasLoaded) {
      await new Promise((resolve) => scene.addEventListener('loaded', resolve, { once: true }));
    }
    welcome.hidden = true;
    arUi.hidden = false;
    status.textContent = '正在启动摄像头…';
    const arSystem = scene.systems['mindar-image-system'];
    arSystem.start();
    arSystem.video?.addEventListener('loadeddata', () => {
      if (arState === 'starting') status.textContent = '摄像头已开启，正在准备图像识别…';
    }, { once: true });
  } catch (error) {
    showStartError(error);
  }
};

startButton.addEventListener('click', startAr);
document.querySelector('#help-button').addEventListener('click', () => helpDialog.showModal());
document.querySelector('#close-help').addEventListener('click', () => helpDialog.close());

document.querySelectorAll('.ar-target').forEach((target) => {
  const model = target.querySelector('.model');
  const surface = target.querySelector('.video-surface');
  const video = document.createElement('video');
  video.id = `target-video-${target.dataset.index}`;
  video.preload = 'none';
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.crossOrigin = 'anonymous';
  document.querySelector('#media-assets').append(video);
  targetMedia.set(target, { video, userPaused: false });

  video.addEventListener('loadedmetadata', () => {
    surface.setAttribute('height', 0.64 * video.videoHeight / video.videoWidth);
  });
  video.addEventListener('loadeddata', () => surface.setAttribute('visible', true));
  video.addEventListener('playing', () => {
    if (activeTarget !== target || document.hidden) { video.pause(); return; }
    videoStatus.textContent = '视频播放中';
    syncVideoControls();
  });
  video.addEventListener('pause', () => {
    if (activeTarget === target) {
      videoStatus.textContent = '视频已暂停';
      syncVideoControls();
    }
  });
  video.addEventListener('waiting', () => {
    if (activeTarget === target) videoStatus.textContent = '视频缓冲中…';
  });
  video.addEventListener('error', () => {
    if (activeTarget === target) {
      videoStatus.textContent = '视频加载失败，请点击播放重试';
      syncVideoControls();
    }
  });

  target.addEventListener('targetFound', () => {
    activeTarget = target;
    targetMedia.forEach((media, otherTarget) => { if (otherTarget !== target) media.video.pause(); });
    if (!video.getAttribute('src')) {
      video.src = target.dataset.video;
      surface.setAttribute('src', `#${video.id}`);
    }
    videoStatus.textContent = video.readyState < 2 ? '正在加载视频…' : '视频已暂停';
    if (!targetMedia.get(target).userPaused) playTargetVideo(target);
    syncVideoControls();
    document.body.classList.add('tracking');
    const number = Number(target.dataset.index) + 1;
    targetNumber.textContent = String(number).padStart(2, '0');
    targetName.textContent = target.dataset.name;
    if (!model.getAttribute('gltf-model')) {
      status.textContent = `已识别 ${target.dataset.name}`;
      targetDetail.textContent = '正在下载并准备 3D 模型…';
      model.setAttribute('gltf-model', `url(${target.dataset.model})`);
    } else {
      status.textContent = `已识别 ${target.dataset.name}`;
      targetDetail.textContent = model.dataset.ready ? '模型已就位' : '正在下载并准备 3D 模型…';
    }
  });

  target.addEventListener('model-ready', () => {
    if (activeTarget === target) targetDetail.textContent = '模型已就位';
  });

  model.addEventListener('model-error', () => {
    // Allow the next acquisition to retry a failed model download.
    model.removeAttribute('gltf-model');
    delete model.dataset.ready;
    if (activeTarget === target) targetDetail.textContent = '模型下载失败，请检查网络后移开图片再对准';
  });

  target.addEventListener('targetLost', () => {
    video.pause();
    if (activeTarget !== target) return;
    activeTarget = null;
    syncVideoControls();
    document.body.classList.remove('tracking');
    status.textContent = '目标已离开画面';
    targetName.textContent = '等待重新识别';
    targetDetail.textContent = '请将目标图放回取景框';
  });
});
