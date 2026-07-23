const api = typeof browser !== 'undefined' ? browser : chrome;

api.runtime.onMessage.addListener((message) => {
  if (message.type === 'DLCHAN_SHOW_BAR') showBar(message.filename, message.url);
});

function showBar(filename, url) {
  const existing = document.getElementById('dlchan-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'dlchan-bar';
  bar.innerHTML = `
    <span class="dlchan-play">&#9654;</span>
    <span class="dlchan-text">ดาวน์โหลดวิดีโอนี้</span>
    <button class="dlchan-close" title="ปิด" type="button">&#10005;</button>
  `;
  document.documentElement.appendChild(bar);

  const queueAndClose = () => {
    api.runtime.sendMessage({ type: 'DLCHAN_QUEUE', url, filename });
    bar.remove();
  };

  bar.querySelector('.dlchan-play').addEventListener('click', queueAndClose);
  bar.querySelector('.dlchan-text').addEventListener('click', queueAndClose);
  bar.querySelector('.dlchan-close').addEventListener('click', () => bar.remove());

  setTimeout(() => bar.remove(), 12000);
}
