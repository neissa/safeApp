/* Panneau galerie : photos du téléphone, prise de photo avec la caméra si l'appareil le permet */
(function () {
  "use strict";

  const KA = window.KA;
  let root, grid, empty, fileInput, cameraInput, camBox, video, shotBtn;
  let viewer, viewerImg, viewerDel;
  let stream = null;
  let urls = []; // URLs d'objets à libérer au prochain affichage
  let viewing = null; // photo ouverte en grand

  async function render() {
    const photos = await KA.db.list("photo");
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    grid.innerHTML = "";
    empty.hidden = photos.length > 0;
    photos.forEach((p) => {
      const url = URL.createObjectURL(p.blob);
      urls.push(url);
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("click", () => openViewer(p, url));
      grid.appendChild(img);
    });
  }

  function openViewer(item, url) {
    viewing = item;
    viewerImg.src = url;
    viewer.hidden = false;
  }

  function closeViewer() {
    viewer.hidden = true;
    viewerImg.removeAttribute("src");
    viewing = null;
  }

  async function deleteViewing() {
    if (!viewing) return;
    await KA.db.del(viewing.id);
    closeViewer();
    KA.speak("Photo effacée");
    render();
  }

  async function importFiles(files) {
    for (const f of Array.from(files)) {
      await KA.db.put({ id: KA.db.newId("photo"), kind: "photo", createdAt: Date.now(), name: f.name, blob: f });
    }
    fileInput.value = "";
    cameraInput.value = "";
    render();
  }

  async function openCamera() {
    const canLive = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (!canLive) {
      cameraInput.click(); // repli : appareil photo natif
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      video.srcObject = stream;
      camBox.hidden = false;
    } catch (err) {
      KA.speak("Je ne peux pas utiliser la caméra");
      cameraInput.click();
    }
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    camBox.hidden = true;
  }

  async function takeShot() {
    if (!stream || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) return;
    camBox.classList.remove("flash");
    void camBox.offsetWidth; // relance l'animation
    camBox.classList.add("flash");
    await KA.db.put({ id: KA.db.newId("photo"), kind: "photo", createdAt: Date.now(), name: "photo.jpg", blob });
    KA.speak("Clic !");
    render();
  }

  KA.panels.gallery = {
    init(r) {
      root = r;
      grid = root.querySelector("#gallery-grid");
      empty = root.querySelector("#gallery-empty");
      fileInput = root.querySelector("#photo-file");
      cameraInput = root.querySelector("#camera-file");
      camBox = root.querySelector("#cam-box");
      video = root.querySelector("#cam-video");
      shotBtn = root.querySelector("#cam-shot");
      viewer = root.querySelector("#viewer");
      viewerImg = root.querySelector("#viewer-img");
      viewerDel = root.querySelector("#viewer-del");

      root.querySelector("#cam-open").addEventListener("click", openCamera);
      root.querySelector("#photo-pick").addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => importFiles(fileInput.files));
      cameraInput.addEventListener("change", () => importFiles(cameraInput.files));
      shotBtn.addEventListener("click", takeShot);
      root.querySelector("#cam-close").addEventListener("click", stopCamera);
      root.querySelector("#viewer-close").addEventListener("click", closeViewer);
      viewerDel.addEventListener("click", () => KA.armed(viewerDel, deleteViewing));
    },
    enter() {
      render();
    },
    leave() {
      stopCamera();
      closeViewer();
    },
  };
})();
