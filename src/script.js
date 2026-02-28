// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

function enablePipOnTheWebsite() {
  const host = location.hostname || "";
  const isStreamingPlatform =
    host === "netflix.com" || host.endsWith(".netflix.com") || host === "disneyplus.com" || host.endsWith(".disneyplus.com");

  if (!isStreamingPlatform) {
    return;
  }

  const enablePipOnVideos = () => {
    const videos = document.querySelectorAll("video");
    try {
      videos.forEach(video => {
        console.log("Enabling picture-in-picture for", video);
        if (video.hasAttribute("disablepictureinpicture")) {
          video.removeAttribute("disablepictureinpicture");
        }
      });
    } catch (e) {}
  };

  enablePipOnVideos();

  const target = document.documentElement || document.body;
  if (target) {
    const observer = new MutationObserver(() => {
      enablePipOnVideos();
    });
    observer.observe(target, { childList: true, subtree: true });
  }
}

function findLargestPlayingVideo() {
  enablePipOnTheWebsite();
  const videos = Array.from(document.querySelectorAll('video'))
    .filter(video => video.readyState != 0)
    .filter(video => video.disablePictureInPicture == false)
    .sort((v1, v2) => {
      const v1Rect = v1.getClientRects()[0]||{width:0,height:0};
      const v2Rect = v2.getClientRects()[0]||{width:0,height:0};
      return ((v2Rect.width * v2Rect.height) - (v1Rect.width * v1Rect.height));
    });

  if (videos.length === 0) {
    return;
  }

  return videos[0];
}

async function requestPictureInPicture(video) {
  await video.requestPictureInPicture();
  video.setAttribute('__pip__', true);
  video.addEventListener('leavepictureinpicture', event => {
    video.removeAttribute('__pip__');
  }, { once: true });
  new ResizeObserver(maybeUpdatePictureInPictureVideo).observe(video);
}

function maybeUpdatePictureInPictureVideo(entries, observer) {
  const observedVideo = entries[0].target;
  if (!document.querySelector('[__pip__]')) {
    observer.unobserve(observedVideo);
    return;
  }
  const video = findLargestPlayingVideo();
  if (video && !video.hasAttribute('__pip__')) {
    observer.unobserve(observedVideo);
    requestPictureInPicture(video);
  }
}

(async () => {
  const video = findLargestPlayingVideo();
  if (video) {
    if (video.hasAttribute('__pip__')) {
      document.exitPictureInPicture();
      return;
    }
    await requestPictureInPicture(video);
    return;
  }

  const timeout = 10000;
  const start = Date.now();
  await new Promise((resolve) => {
    const observer = new MutationObserver(async () => {
      const v = findLargestPlayingVideo();
      if (v) {
        observer.disconnect();
        if (!v.hasAttribute('__pip__')) {
          await requestPictureInPicture(v);
        }
        resolve();
      } else if (Date.now() - start > timeout) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
})();
