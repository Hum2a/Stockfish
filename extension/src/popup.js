import { inspectBoard, activeChessTab, requestTabAccess } from './inspect.js';

const $ = (id) => document.getElementById(id);
let tab;
try {
  tab = await activeChessTab();
  const result = await inspectBoard(tab.id);
  if (result.error && !result.boardCount) throw new Error(result.error);
  $('source').textContent = `${result.host || 'Selected tab'} · ${result.boardCount} board${result.boardCount === 1 ? '' : 's'} detected`;
  $('board').replaceChildren(...Array.from({ length: result.boardCount }, (_, i) => new Option(`Board ${i + 1}`, String(i))));
  $('start').disabled = false;
} catch (err) { $('source').textContent = err.message || 'Open a Chess.com analysis, game, or replay tab, then click the extension again.'; }
$('open').onclick = () => { chrome.tabs.create({ url: chrome.runtime.getURL('analysis.html') }); window.close(); };
$('start').onclick = async () => {
  $('start').disabled = true;
  try {
    await requestTabAccess(tab);
    const response = await chrome.runtime.sendMessage({ type: 'tracker-start', tabId: tab.id, boardIndex: Number($('board').value), destination: $('destination').value });
    if (response.error) throw new Error(response.error);
    window.close();
  } catch (err) { $('source').textContent = err.message; $('start').disabled = false; }
};
