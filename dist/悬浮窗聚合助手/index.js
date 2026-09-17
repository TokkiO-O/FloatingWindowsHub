/**
 * 悬浮窗聚合助手 - 酒馆助手脚本版
 * 把其他插件的悬浮窗收纳到一个统一的悬浮球菜单里
 *
 * 安装：酒馆助手 → 脚本库 → 全局脚本 → 新建脚本 → 粘贴本文件全部内容 → 启用
 * 建议勾选按钮：「打开设置」「扫描候选」「全部显示」「全部隐藏」
 */

(function () {
  'use strict';

  const SCRIPT_KEY = 'fwh_settings';
  const FAB_ID = 'fwh-fab-container';

  const defaultSettings = {
    enabled: true,
    autoHide: true,
    exclusive: true,
    fabPosition: { left: null, top: null, right: 20, bottom: 100 },
    windows: [],
  };

  // ---------- 工具：访问父页面 ----------
  const parentWin = window.parent;
  const parentDoc = parentWin.document;
  const $p = (sel) => $(sel, parentDoc);

  function loadSettings() {
    try {
      const vars = getVariables({ type: 'global' }) || {};
      const raw = vars[SCRIPT_KEY];
      if (raw && typeof raw === 'object') {
        return { ...structuredClone(defaultSettings), ...raw, windows: Array.isArray(raw.windows) ? raw.windows : [] };
      }
    } catch (e) {
      console.warn('[悬浮窗聚合] 读取设置失败', e);
    }
    return structuredClone(defaultSettings);
  }

  function saveSettings(settings) {
    try {
      insertOrAssignVariables({ [SCRIPT_KEY]: settings }, { type: 'global' });
    } catch (e) {
      console.warn('[悬浮窗聚合] 保存设置失败', e);
    }
  }

  let settings = loadSettings();

  // ---------- 显示 / 隐藏（用「移出屏幕」代替 display:none，减少和插件打架闪烁）----------
  function resolveElements(selector) {
    try {
      return Array.from(parentDoc.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  /** 从元素猜一个可读名字，避免菜单里只显示 #id */
  function guessElementName(el, selector) {
    const aria = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-title') || '';
    if (aria.trim()) return aria.trim().slice(0, 30);

    // 常见插件 class 关键词
    const cls = (el.className && String(el.className)) || '';
    const id = el.id || '';
    const blob = (cls + ' ' + id).toLowerCase();
    const map = [
      [/om-fab|outfit|穿搭|fa-shirt/, '穿搭管理'],
      [/scene|tsp-fab|酒馆场景|tag-market/, '酒馆场景'],
      [/jumper|chat-jumper|楼层/, '楼层跳转'],
      [/quickbar|quick-bar/, '快捷栏'],
      [/tracker|stat/, '状态追踪'],
      [/calendar|月历/, '月历'],
      [/float.*nav|导航/, '悬浮导航'],
      [/image|gallery|图片/, '图片相关'],
      [/music|audio|音乐/, '音乐'],
      [/qr|quick.?reply/, '快速回复'],
    ];
    for (const [re, name] of map) {
      if (re.test(blob)) return name;
    }

    const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (text && text.length <= 20 && !/^[#.]/.test(text)) return text;

    // class 里挑一个不像哈希的
    const niceClass = Array.from(el.classList || []).find(
      (c) => c.length > 2 && c.length < 24 && !/^[a-f0-9]{6,}$/i.test(c) && !c.startsWith('fa-'),
    );
    if (niceClass) return niceClass;

    if (id && id.length < 30) return id;
    return selector.length > 28 ? selector.slice(0, 28) + '…' : selector;
  }

  function isOutfitManagerWin(win) {
    const s = (win && win.selector) || '';
    const n = (win && win.name) || '';
    return /om-fab|#om-fab|outfit/i.test(s) || /穿搭/.test(n);
  }

  /**
   * 穿搭管理器每 3 秒 injectFab，会用内联 !important 把 opacity/display 写死。
   * 和它抢内联样式 = 必闪。改为只挂「全局 CSS」：
   * - 它从不写 transform，所以 scale(0) 能稳定盖住
   * - 不碰 display/visibility/opacity/屏内位置，避免 fabNeedsRebuild
   * 无定时器打架，不应再闪。
   */
  function setOutfitFabCssHidden(hidden) {
    const id = 'fwh-om-fab-hide-css';
    let style = parentDoc.getElementById(id);
    if (hidden) {
      if (!style) {
        style = parentDoc.createElement('style');
        style.id = id;
        (parentDoc.head || parentDoc.documentElement).appendChild(style);
      }
      style.textContent = `
#om-fab-main {
  transform: scale(0) !important;
  pointer-events: none !important;
}
#om-fab-main #om-fab-main-btn,
#om-fab-main * {
  pointer-events: none !important;
}
`;
    } else if (style) {
      style.remove();
    }
  }

  function hideElement(el) {
    if (!el || el.id === FAB_ID || el.closest?.('#' + FAB_ID)) return;
    if (el.id === 'om-fab-main' || el.closest?.('#om-fab-main')) {
      setOutfitFabCssHidden(true);
      return;
    }
    if (!el.dataset.fwhSaved) {
      el.dataset.fwhSaved = '1';
      el.dataset.fwhCssText = el.style.cssText || '';
    }
    el.style.setProperty('transform', 'scale(0)', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.dataset.fwhHiddenBy = 'fwh';
  }

  function restoreElementStyles(el) {
    if (!el) return;
    if (el.id === 'om-fab-main' || el.closest?.('#om-fab-main')) {
      setOutfitFabCssHidden(false);
      return;
    }
    const saved = el.dataset.fwhCssText;
    el.style.cssText = saved != null ? saved : '';
    delete el.dataset.fwhHiddenBy;
    delete el.dataset.fwhSaved;
    delete el.dataset.fwhCssText;
  }

  function showElementInPlace(el) {
    if (!el) return;
    restoreElementStyles(el);
  }

  function hideWindow(win) {
    if (isOutfitManagerWin(win)) {
      setOutfitFabCssHidden(true);
      win.hidden = true;
      return;
    }
    resolveElements(win.selector).forEach(hideElement);
    win.hidden = true;
  }

  /** 打开/关闭穿搭管理面板，悬浮球始终保持隐藏 */
  function openOutfitManagerPanel() {
    setOutfitFabCssHidden(true);

    const ov = parentDoc.querySelector('.om-overlay');
    if (ov) {
      const x = ov.querySelector('#om-x');
      if (x) x.click();
      else ov.remove();
      toastr?.info?.('已关闭穿搭管理');
      return;
    }

    // 侧栏扩展按钮（不经过悬浮球）
    const sideBtn = parentDoc.getElementById('outfit-mgr-ext-btn-v4');
    if (sideBtn) {
      sideBtn.click();
      toastr?.success?.('已打开穿搭管理');
      return;
    }

    // 兜底：点一下球再立刻藏回去
    setOutfitFabCssHidden(false);
    parentWin.requestAnimationFrame(() => {
      const btn =
        parentDoc.getElementById('om-fab-main-btn') ||
        parentDoc.querySelector('#om-fab-main img, #om-fab-main > div');
      if (btn) {
        btn.dispatchEvent(
          new parentWin.MouseEvent('click', { bubbles: true, cancelable: true, view: parentWin }),
        );
      } else {
        toastr?.warning?.('打不开穿搭管理：请确认插件已加载');
      }
      parentWin.setTimeout(() => setOutfitFabCssHidden(true), 40);
    });
  }

  /** 像悬浮球（小按钮）还是整块面板 */
  function isLikelyFab(el) {
    if (!el) return true;
    if (el.id === 'om-fab-main') return true;
    try {
      const r = el.getBoundingClientRect();
      // 未显示时用 scroll 尺寸兜底
      const w = r.width || el.offsetWidth || 40;
      const h = r.height || el.offsetHeight || 40;
      return w > 0 && h > 0 && w <= 120 && h <= 120;
    } catch {
      return true;
    }
  }

  /**
   * 启动器式打开（通用）：
   * - 悬浮球类：短暂显示 → 点击打开插件界面 → 再把球藏回去（保持「已隐藏」）
   * - 大面板类：显示出来供使用；再点一次菜单可收起
   */
  function openAsLauncher(win) {
    if (isOutfitManagerWin(win)) {
      openOutfitManagerPanel();
      win.hidden = true;
      setOutfitFabCssHidden(true);
      return;
    }

    const els = resolveElements(win.selector);
    if (!els.length) {
      toastr?.warning?.(`未找到：${win.name}`);
      return;
    }
    const root = els[0];
    const fabLike = isLikelyFab(root);

    // 先显示，才能点到
    els.forEach(showElementInPlace);

    parentWin.setTimeout(() => {
      try {
        const t =
          root.querySelector?.('#om-fab-main-btn,button,[role="button"],img,a,.fa-solid') || root;
        t.dispatchEvent(
          new parentWin.MouseEvent('click', { bubbles: true, cancelable: true, view: parentWin }),
        );
      } catch {}

      if (fabLike) {
        // 球只负责「点一下打开」，界面一般是另一个 DOM，球继续藏
        parentWin.setTimeout(() => {
          els.forEach(hideElement);
          win.hidden = true;
          saveSettings(settings);
          renderMenu();
        }, 120);
        toastr?.success?.(`已打开：${win.name}（悬浮球保持隐藏）`);
      } else {
        // 注册的是整块面板：保持显示，再点菜单可隐藏
        win.hidden = false;
        saveSettings(settings);
        renderMenu();
        toastr?.success?.(`已显示：${win.name}`);
      }
    }, 40);
  }

  function showWindow(win) {
    openAsLauncher(win);
  }

  function toggleWindow(win) {
    closeMenu();

    if (isOutfitManagerWin(win)) {
      openOutfitManagerPanel();
      win.hidden = true;
      setOutfitFabCssHidden(true);
      saveSettings(settings);
      renderMenu();
      return;
    }

    // 大面板且当前正在显示 → 再点一次 = 收起
    if (!win.hidden) {
      const els = resolveElements(win.selector);
      const panelOpen = els.length && !isLikelyFab(els[0]);
      if (panelOpen) {
        hideWindow(win);
        toastr?.info?.(`已隐藏：${win.name}`);
        saveSettings(settings);
        renderMenu();
        return;
      }
    }

    // 默认：启动器打开（藏球 / 显示面板）
    openAsLauncher(win);
  }

  function hideAll() {
    settings.windows.forEach(hideWindow);
    saveSettings(settings);
    renderMenu();
    toastr?.info?.('已全部隐藏');
  }

  function showAll() {
    settings.windows.forEach((w) => {
      if (isOutfitManagerWin(w)) {
        // 穿搭球仍保持隐藏，只打开面板
        openOutfitManagerPanel();
        w.hidden = true;
      } else {
        resolveElements(w.selector).forEach(showElementInPlace);
        w.hidden = false;
      }
    });
    saveSettings(settings);
    renderMenu();
    toastr?.info?.('已处理全部');
  }

  // 关掉 200ms 抢样式（那是闪烁主因）；穿搭只靠 CSS 规则
  let rehideTimer = null;
  function startRehideWatch() {
    settings.windows.forEach((w) => {
      if (w.hidden && isOutfitManagerWin(w)) setOutfitFabCssHidden(true);
    });
  }
  function stopRehideWatch() {
    setOutfitFabCssHidden(false);
  }

  // ---------- 注入样式到父页面 ----------
  function injectStyles() {
    if (parentDoc.getElementById('fwh-styles')) return;
    const style = parentDoc.createElement('style');
    style.id = 'fwh-styles';
    style.textContent = `
#fwh-fab-container {
  position: fixed; z-index: 99999; touch-action: none; user-select: none; font-family: inherit;
}
#fwh-fab {
  width: 48px; height: 48px; border-radius: 50%;
  background: linear-gradient(135deg, #6c5ce7, #a29bfe);
  color: #fff; display: flex; align-items: center; justify-content: center;
  cursor: grab; box-shadow: 0 4px 12px rgba(0,0,0,.35);
  transition: transform .15s ease, box-shadow .15s ease; font-size: 20px;
}
#fwh-fab:hover { transform: scale(1.08); box-shadow: 0 6px 16px rgba(0,0,0,.45); }
#fwh-fab:active { cursor: grabbing; transform: scale(.96); }
#fwh-fab.menu-open { background: linear-gradient(135deg, #5a4bd1, #8b7fe0); }
#fwh-menu {
  position: absolute; bottom: 58px; left: 50%; transform: translateX(-50%) scale(.9);
  min-width: 220px; max-width: 280px; max-height: 60vh; overflow-y: auto;
  background: var(--SmartThemeBlurTintColor, rgba(30,30,40,.95));
  border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,.12));
  border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.4);
  opacity: 0; pointer-events: none; transition: opacity .18s ease, transform .18s ease;
  padding: 6px 0; backdrop-filter: blur(8px);
}
#fwh-fab-container.menu-open #fwh-menu {
  opacity: 1; pointer-events: auto; transform: translateX(-50%) scale(1);
}
#fwh-fab-container.menu-down #fwh-menu { bottom: auto; top: 58px; }
.fwh-menu-header { padding: 8px 14px 6px; font-size: 12px; opacity: .7; text-transform: uppercase; letter-spacing: .5px; }
.fwh-menu-item {
  display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 14px;
  transition: background .12s ease; font-size: 14px;
}
.fwh-menu-item:hover { background: rgba(255,255,255,.06); }
.fwh-menu-item.active { background: rgba(108,92,231,.18); }
.fwh-menu-item .fwh-item-icon { width: 18px; text-align: center; opacity: .85; }
.fwh-menu-item .fwh-item-name {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  cursor: pointer; padding: 6px 0;
}
.fwh-menu-item .fwh-item-name:hover { color: #a29bfe; }
.fwh-menu-item .fwh-eye-btn {
  flex-shrink: 0; width: 32px; height: 28px; border: none; border-radius: 6px;
  background: transparent; color: inherit; cursor: pointer; opacity: .75;
  display: flex; align-items: center; justify-content: center; font-size: 14px; padding: 0;
}
.fwh-menu-item .fwh-eye-btn:hover { opacity: 1; background: rgba(255,255,255,.12); }
.fwh-menu-item .fwh-eye-btn.is-hidden { opacity: .4; }
.fwh-menu-item .fwh-item-status { font-size: 11px; opacity: .55; min-width: 2.2em; text-align: right; }
.fwh-menu-item[data-action] { cursor: pointer; gap: 10px; padding: 10px 14px; }
.fwh-menu-divider { height: 1px; background: rgba(255,255,255,.1); margin: 4px 10px; }
.fwh-menu-empty { padding: 16px 14px; text-align: center; opacity: .6; font-size: 13px; }
#fwh-settings-modal {
  position: fixed; inset: 0; z-index: 100000; background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
}
#fwh-settings-panel {
  width: min(480px, 92vw); max-height: 80vh; overflow-y: auto;
  background: var(--SmartThemeBlurTintColor, #1e1e28);
  border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,.12));
  border-radius: 12px; padding: 16px 18px; color: inherit;
}
#fwh-settings-panel h3 { margin: 0 0 12px; }
#fwh-settings-panel .fwh-row { display: flex; gap: 8px; margin: 8px 0; flex-wrap: wrap; align-items: center; }
#fwh-settings-panel input[type=text] { flex: 1; min-width: 120px; }
#fwh-settings-panel .fwh-window-row { display: flex; gap: 6px; margin: 6px 0; align-items: center; }
#fwh-settings-panel .fwh-hint { font-size: 12px; opacity: .7; line-height: 1.4; margin-top: 6px; }
#fwh-settings-panel .fwh-scan-item { padding: 4px 0; cursor: pointer; font-size: 12px; }
#fwh-settings-panel .fwh-scan-item:hover { background: rgba(128,128,128,.15); }
#fwh-host-panel {
  position: fixed; z-index: 99997; display: none; flex-direction: column;
  left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: min(520px, 92vw); height: min(70vh, 640px);
  background: var(--SmartThemeBlurTintColor, #1e1e28);
  border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,.15));
  border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.5);
  overflow: hidden;
}
#fwh-host-panel .fwh-host-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; cursor: move; user-select: none;
  background: rgba(108,92,231,.25); border-bottom: 1px solid rgba(255,255,255,.08);
  font-size: 14px; flex-shrink: 0;
}
#fwh-host-panel .fwh-host-close {
  border: none; background: transparent; color: inherit; font-size: 20px;
  line-height: 1; cursor: pointer; padding: 0 6px; opacity: .8;
}
#fwh-host-panel .fwh-host-close:hover { opacity: 1; }
#fwh-host-panel .fwh-host-body {
  flex: 1; overflow: auto; padding: 8px; position: relative;
}
    `;
    parentDoc.head.appendChild(style);
  }

  // ---------- 悬浮球 ----------
  let fabContainer = null;
  let isDragging = false;
  let moved = false;
  let dragStartX = 0, dragStartY = 0, startLeft = 0, startTop = 0;

  function createFab() {
    if (parentDoc.getElementById(FAB_ID)) {
      fabContainer = parentDoc.getElementById(FAB_ID);
      return;
    }
    injectStyles();

    fabContainer = parentDoc.createElement('div');
    fabContainer.id = FAB_ID;

    const fab = parentDoc.createElement('div');
    fab.id = 'fwh-fab';
    fab.innerHTML = '<i class="fa-solid fa-layer-group"></i>';
    fab.title = '悬浮窗聚合助手';

    const menu = parentDoc.createElement('div');
    menu.id = 'fwh-menu';

    fabContainer.appendChild(fab);
    fabContainer.appendChild(menu);
    parentDoc.body.appendChild(fabContainer);

    applyFabPosition();
    bindFabEvents(fab);
    renderMenu();
  }

  function destroyFab() {
    const el = parentDoc.getElementById(FAB_ID);
    if (el) el.remove();
    fabContainer = null;
    const style = parentDoc.getElementById('fwh-styles');
    if (style) style.remove();
  }

  function applyFabPosition() {
    if (!fabContainer) return;
    const pos = settings.fabPosition || {};
    fabContainer.style.left = pos.left != null ? pos.left + 'px' : 'auto';
    fabContainer.style.top = pos.top != null ? pos.top + 'px' : 'auto';
    fabContainer.style.right = pos.right != null ? pos.right + 'px' : 'auto';
    fabContainer.style.bottom = pos.bottom != null ? pos.bottom + 'px' : 'auto';
  }

  function saveFabPosition() {
    if (!fabContainer) return;
    const rect = fabContainer.getBoundingClientRect();
    settings.fabPosition = { left: Math.round(rect.left), top: Math.round(rect.top), right: null, bottom: null };
    saveSettings(settings);
  }

  function bindFabEvents(fab) {
    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      isDragging = true;
      moved = false;
      const rect = fabContainer.getBoundingClientRect();
      dragStartX = e.clientX ?? e.touches?.[0]?.clientX;
      dragStartY = e.clientY ?? e.touches?.[0]?.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      fabContainer.style.left = startLeft + 'px';
      fabContainer.style.top = startTop + 'px';
      fabContainer.style.right = 'auto';
      fabContainer.style.bottom = 'auto';
      parentDoc.addEventListener('pointermove', onMove);
      parentDoc.addEventListener('pointerup', onUp);
      parentDoc.addEventListener('touchmove', onMove, { passive: false });
      parentDoc.addEventListener('touchend', onUp);
    };

    const onMove = (e) => {
      if (!isDragging) return;
      e.preventDefault?.();
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      const dx = cx - dragStartX;
      const dy = cy - dragStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      let nl = startLeft + dx;
      let nt = startTop + dy;
      const w = fabContainer.offsetWidth;
      const h = fabContainer.offsetHeight;
      nl = Math.max(0, Math.min(parentWin.innerWidth - w, nl));
      nt = Math.max(0, Math.min(parentWin.innerHeight - h, nt));
      fabContainer.style.left = nl + 'px';
      fabContainer.style.top = nt + 'px';
    };

    const onUp = () => {
      if (!isDragging) return;
      isDragging = false;
      parentDoc.removeEventListener('pointermove', onMove);
      parentDoc.removeEventListener('pointerup', onUp);
      parentDoc.removeEventListener('touchmove', onMove);
      parentDoc.removeEventListener('touchend', onUp);
      if (moved) {
        saveFabPosition();
        closeMenu();
      } else {
        toggleMenu();
      }
    };

    fab.addEventListener('pointerdown', onDown);
    fab.addEventListener('touchstart', onDown, { passive: true });

    parentDoc.addEventListener('click', (e) => {
      if (!fabContainer?.classList.contains('menu-open')) return;
      if (!fabContainer.contains(e.target)) closeMenu();
    });
  }

  function toggleMenu() {
    if (!fabContainer) return;
    const open = fabContainer.classList.toggle('menu-open');
    parentDoc.getElementById('fwh-fab')?.classList.toggle('menu-open', open);
    if (open) {
      const rect = fabContainer.getBoundingClientRect();
      fabContainer.classList.toggle('menu-down', rect.top < parentWin.innerHeight / 2);
      renderMenu();
    }
  }

  function closeMenu() {
    fabContainer?.classList.remove('menu-open');
    parentDoc.getElementById('fwh-fab')?.classList.remove('menu-open');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 只改显示/隐藏，不触发「打开插件」 */
  function setWindowVisible(win, visible) {
    if (visible) {
      if (isOutfitManagerWin(win)) {
        setOutfitFabCssHidden(false);
        win.hidden = false;
      } else {
        resolveElements(win.selector).forEach(showElementInPlace);
        win.hidden = false;
      }
      toastr?.info?.(`已显示：${win.name}`);
    } else {
      hideWindow(win);
      toastr?.info?.(`已隐藏：${win.name}`);
    }
    saveSettings(settings);
    renderMenu();
  }

  function renderMenu() {
    const menu = parentDoc.getElementById('fwh-menu');
    if (!menu) return;

    let html = '';
    if (!settings.windows.length) {
      html += `<div class="fwh-menu-empty">暂无注册悬浮窗<br>请点下方「打开设置」添加</div>`;
    } else {
      html += `<div class="fwh-menu-header">点名字=打开 · 眼睛=显隐</div>`;
      settings.windows.forEach((win, idx) => {
        const active = win.hidden ? '' : 'active';
        const eyeIcon = win.hidden ? 'fa-eye-slash' : 'fa-eye';
        const eyeTitle = win.hidden ? '显示悬浮球/窗' : '隐藏悬浮球/窗';
        const eyeClass = win.hidden ? 'is-hidden' : '';
        html += `
          <div class="fwh-menu-item ${active}">
            <span class="fwh-item-name" data-open-idx="${idx}" title="打开插件">${escapeHtml(win.name)}</span>
            <span class="fwh-item-status">${win.hidden ? '已藏' : '显示'}</span>
            <button type="button" class="fwh-eye-btn ${eyeClass}" data-eye-idx="${idx}" title="${eyeTitle}">
              <i class="fa-solid ${eyeIcon}"></i>
            </button>
          </div>`;
      });
    }

    html += `<div class="fwh-menu-divider"></div>
      <div class="fwh-menu-item" data-action="settings"><span class="fwh-item-icon"><i class="fa-solid fa-gear"></i></span><span class="fwh-item-name">打开设置</span></div>
      <div class="fwh-menu-item" data-action="hide-all"><span class="fwh-item-icon"><i class="fa-solid fa-eye-slash"></i></span><span class="fwh-item-name">全部隐藏</span></div>
      <div class="fwh-menu-item" data-action="show-all"><span class="fwh-item-icon"><i class="fa-solid fa-eye"></i></span><span class="fwh-item-name">全部显示</span></div>`;

    menu.innerHTML = html;

    // 点名字 → 只打开插件（启动器）
    menu.querySelectorAll('[data-open-idx]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const win = settings.windows[Number(el.dataset.openIdx)];
        if (!win) return;
        closeMenu();
        openAsLauncher(win);
        saveSettings(settings);
        renderMenu();
      });
    });
    // 点眼睛 → 只切换显示/隐藏
    menu.querySelectorAll('[data-eye-idx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const win = settings.windows[Number(btn.dataset.eyeIdx)];
        if (!win) return;
        setWindowVisible(win, !!win.hidden);
      });
    });
    menu.querySelector('[data-action="hide-all"]')?.addEventListener('click', (e) => { e.stopPropagation(); hideAll(); });
    menu.querySelector('[data-action="show-all"]')?.addEventListener('click', (e) => { e.stopPropagation(); showAll(); });
    menu.querySelector('[data-action="settings"]')?.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); openSettingsModal(); });
  }

  // ---------- 设置弹窗 ----------
  function openSettingsModal() {
    if (parentDoc.getElementById('fwh-settings-modal')) return;

    const modal = parentDoc.createElement('div');
    modal.id = 'fwh-settings-modal';
    modal.innerHTML = `
      <div id="fwh-settings-panel">
        <h3>悬浮窗聚合助手 · 设置</h3>
        <label><input type="checkbox" id="fwh_auto_hide" ${settings.autoHide ? 'checked' : ''}/> 启动时自动收起已注册悬浮窗</label><br>
        <label><input type="checkbox" id="fwh_exclusive" ${settings.exclusive ? 'checked' : ''}/> 互斥模式（打开一个关其他）</label>
        <hr>
        <div><b>已注册列表</b></div>
        <div id="fwh_list"></div>
        <div class="fwh-row">
          <input type="text" id="fwh_name" class="text_pole" placeholder="显示名称"/>
          <input type="text" id="fwh_sel" class="text_pole" placeholder="CSS 选择器"/>
          <button class="menu_button" id="fwh_add">添加</button>
        </div>
        <div class="fwh-hint">F12 审查元素 → Copy selector。示例：.tsp-fab-container</div>
        <hr>
        <div class="fwh-row">
          <button class="menu_button" id="fwh_scan">扫描候选</button>
          <button class="menu_button" id="fwh_show">全部显示</button>
          <button class="menu_button" id="fwh_hide">全部隐藏</button>
          <button class="menu_button" id="fwh_close">关闭</button>
        </div>
        <div id="fwh_scan_result"></div>
      </div>`;
    parentDoc.body.appendChild(modal);

    const renderList = () => {
      const list = parentDoc.getElementById('fwh_list');
      if (!settings.windows.length) {
        list.innerHTML = '<div class="fwh-hint">暂无条目</div>';
        return;
      }
      list.innerHTML = settings.windows
        .map(
          (w, i) => `
        <div class="fwh-window-row" data-i="${i}">
          <input type="text" class="text_pole fwh-n" value="${escapeHtml(w.name)}"/>
          <input type="text" class="text_pole fwh-s" value="${escapeHtml(w.selector)}"/>
          <button class="menu_button fwh-del">删</button>
        </div>`,
        )
        .join('');
      list.querySelectorAll('.fwh-window-row').forEach((row) => {
        const i = Number(row.dataset.i);
        row.querySelector('.fwh-n').addEventListener('change', (e) => {
          settings.windows[i].name = e.target.value.trim() || `窗口${i + 1}`;
          saveSettings(settings);
          renderMenu();
        });
        row.querySelector('.fwh-s').addEventListener('change', (e) => {
          settings.windows[i].selector = e.target.value.trim();
          saveSettings(settings);
        });
        row.querySelector('.fwh-del').addEventListener('click', () => {
          showWindow(settings.windows[i]);
          settings.windows.splice(i, 1);
          saveSettings(settings);
          renderList();
          renderMenu();
        });
      });
    };

    renderList();

    parentDoc.getElementById('fwh_auto_hide').addEventListener('change', (e) => {
      settings.autoHide = e.target.checked;
      saveSettings(settings);
    });
    parentDoc.getElementById('fwh_exclusive').addEventListener('change', (e) => {
      settings.exclusive = e.target.checked;
      saveSettings(settings);
    });

    parentDoc.getElementById('fwh_add').addEventListener('click', () => {
      const name = parentDoc.getElementById('fwh_name').value.trim();
      const sel = parentDoc.getElementById('fwh_sel').value.trim();
      if (!sel) {
        toastr?.warning?.('请填写选择器');
        return;
      }
      try {
        parentDoc.querySelector(sel);
      } catch {
        toastr?.error?.('选择器无效');
        return;
      }
      settings.windows.push({ name: name || sel, selector: sel, hidden: false });
      if (settings.autoHide) hideWindow(settings.windows[settings.windows.length - 1]);
      saveSettings(settings);
      parentDoc.getElementById('fwh_name').value = '';
      parentDoc.getElementById('fwh_sel').value = '';
      renderList();
      renderMenu();
      toastr?.success?.('已添加');
    });

    parentDoc.getElementById('fwh_scan').addEventListener('click', () => {
      const result = parentDoc.getElementById('fwh_scan_result');
      const candidates = [];
      const seen = new Set();
      parentDoc.querySelectorAll('body *').forEach((el) => {
        if (el.id === FAB_ID || el.closest?.('#' + FAB_ID)) return;
        const st = parentWin.getComputedStyle(el);
        if (st.position !== 'fixed' && st.position !== 'absolute') return;
        const z = parseInt(st.zIndex, 10);
        if (isNaN(z) || z < 100) return;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) return;
        if (r.width > parentWin.innerWidth * 0.95 && r.height > parentWin.innerHeight * 0.95) return;
        let selector = '';
        if (el.id) selector = '#' + CSS.escape(el.id);
        else if (el.classList.length) {
          const cls = Array.from(el.classList)
            .filter((c) => c && !c.startsWith('fa-'))
            .slice(0, 2)
            .map((c) => '.' + CSS.escape(c))
            .join('');
          if (cls) selector = cls;
        }
        if (!selector || seen.has(selector)) return;
        seen.add(selector);
        // 尽量起一个好看的中文/可读名字，而不是 #xxx
        const name = guessElementName(el, selector);
        candidates.push({ selector, text: name, z });
      });
      candidates.sort((a, b) => b.z - a.z);
      if (!candidates.length) {
        result.innerHTML = '<div class="fwh-hint">未发现候选</div>';
        return;
      }
      result.innerHTML =
        '<div class="fwh-hint">点击添加（可稍后在列表里改名字）：</div>' +
        candidates
          .slice(0, 25)
          .map(
            (c) =>
              `<div class="fwh-scan-item" data-s="${escapeHtml(c.selector)}" data-n="${escapeHtml(c.text)}">
                <b>${escapeHtml(c.text)}</b>
                <code style="opacity:.65;font-size:11px">${escapeHtml(c.selector)}</code>
                <span style="opacity:.5">z=${c.z}</span>
              </div>`,
          )
          .join('');
      result.querySelectorAll('.fwh-scan-item').forEach((item) => {
        item.addEventListener('click', () => {
          const sel = item.dataset.s;
          if (settings.windows.some((w) => w.selector === sel)) {
            toastr?.info?.('已存在');
            return;
          }
          // 添加时弹出改名，避免一直是 #id
          let displayName = item.dataset.n || sel;
          const input = parentWin.prompt('给这个悬浮窗起个名字（例如：场景插件 / 楼层跳转）', displayName);
          if (input === null) return;
          displayName = (input || displayName).trim() || displayName;
          settings.windows.push({ name: displayName, selector: sel, hidden: false });
          if (settings.autoHide) hideWindow(settings.windows[settings.windows.length - 1]);
          saveSettings(settings);
          renderList();
          renderMenu();
          toastr?.success?.('已添加：' + displayName);
        });
      });
    });

    parentDoc.getElementById('fwh_show').addEventListener('click', showAll);
    parentDoc.getElementById('fwh_hide').addEventListener('click', hideAll);
    parentDoc.getElementById('fwh_close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // ---------- 脚本按钮 ----------
  try {
    eventOn(getButtonEvent('打开设置'), () => openSettingsModal());
    eventOn(getButtonEvent('扫描候选'), () => {
      openSettingsModal();
      setTimeout(() => parentDoc.getElementById('fwh_scan')?.click(), 100);
    });
    eventOn(getButtonEvent('全部显示'), showAll);
    eventOn(getButtonEvent('全部隐藏'), hideAll);
  } catch (e) {
    // 未配置按钮时忽略
  }

  // ---------- 生命周期 ----------
  function init() {
    settings = loadSettings();
    if (!settings.enabled) return;
    createFab();
    // 恢复上次的隐藏状态
    if (settings.windows.length) {
      settings.windows.forEach((w) => {
        if (settings.autoHide || w.hidden) hideWindow(w);
        else showWindow(w);
      });
      saveSettings(settings);
      renderMenu();
    }
    startRehideWatch();
    console.log('[悬浮窗聚合助手] 已启动');
  }

  $(() => {
    // 等其他插件渲染完
    setTimeout(init, 1200);
  });

  $(window).on('pagehide', () => {
    try {
      stopRehideWatch();
      settings.windows.forEach((w) => {
        resolveElements(w.selector).forEach((el) => {
          if (el.dataset.fwhCssText != null || el.dataset.fwhHiddenBy) restoreElementStyles(el);
        });
        w.hidden = false;
      });
      const om = parentDoc.getElementById('om-fab-main');
      if (om && (om.dataset.fwhCssText != null || om.dataset.fwhHiddenBy)) restoreElementStyles(om);
      destroyFab();
      parentDoc.getElementById('fwh-settings-modal')?.remove();
    } catch {}
  });
})();
