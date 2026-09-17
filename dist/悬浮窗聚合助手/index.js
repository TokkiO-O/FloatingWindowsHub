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
    exclusive: false,
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

  // ---------- 显示 / 隐藏 ----------
  function resolveElements(selector) {
    try {
      return Array.from(parentDoc.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  function hideWindow(win) {
    resolveElements(win.selector).forEach((el) => {
      if (!el.dataset.fwhOriginalDisplay) {
        el.dataset.fwhOriginalDisplay = el.style.display || '';
      }
      el.style.display = 'none';
      el.dataset.fwhHiddenBy = 'fwh';
    });
    win.hidden = true;
  }

  function showWindow(win) {
    resolveElements(win.selector).forEach((el) => {
      const original = el.dataset.fwhOriginalDisplay;
      el.style.display = original !== undefined && original !== '' ? original : '';
      delete el.dataset.fwhHiddenBy;
      delete el.dataset.fwhOriginalDisplay;
    });
    win.hidden = false;
  }

  function toggleWindow(win) {
    if (win.hidden) {
      if (settings.exclusive) {
        settings.windows.forEach((w) => {
          if (w !== win && !w.hidden) hideWindow(w);
        });
      }
      showWindow(win);
    } else {
      hideWindow(win);
    }
    saveSettings(settings);
    renderMenu();
  }

  function hideAll() {
    settings.windows.forEach(hideWindow);
    saveSettings(settings);
    renderMenu();
    toastr?.info?.('已隐藏全部注册悬浮窗');
  }

  function showAll() {
    settings.windows.forEach(showWindow);
    saveSettings(settings);
    renderMenu();
    toastr?.info?.('已显示全部注册悬浮窗');
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
  display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer;
  transition: background .12s ease; font-size: 14px;
}
.fwh-menu-item:hover { background: rgba(255,255,255,.08); }
.fwh-menu-item.active { background: rgba(108,92,231,.25); }
.fwh-menu-item .fwh-item-icon { width: 18px; text-align: center; opacity: .85; }
.fwh-menu-item .fwh-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fwh-menu-item .fwh-item-status { font-size: 11px; opacity: .6; }
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

  function renderMenu() {
    const menu = parentDoc.getElementById('fwh-menu');
    if (!menu) return;

    if (!settings.windows.length) {
      menu.innerHTML = `<div class="fwh-menu-empty">暂无注册悬浮窗<br>点脚本按钮「打开设置」添加</div>`;
      return;
    }

    let html = `<div class="fwh-menu-header">已注册悬浮窗</div>`;
    settings.windows.forEach((win, idx) => {
      const status = win.hidden ? '已隐藏' : '显示中';
      const icon = win.hidden ? 'fa-eye-slash' : 'fa-eye';
      const active = win.hidden ? '' : 'active';
      html += `
        <div class="fwh-menu-item ${active}" data-idx="${idx}">
          <span class="fwh-item-icon"><i class="fa-solid ${icon}"></i></span>
          <span class="fwh-item-name">${escapeHtml(win.name)}</span>
          <span class="fwh-item-status">${status}</span>
        </div>`;
    });
    html += `<div class="fwh-menu-divider"></div>
      <div class="fwh-menu-item" data-action="hide-all"><span class="fwh-item-icon"><i class="fa-solid fa-eye-slash"></i></span><span class="fwh-item-name">全部隐藏</span></div>
      <div class="fwh-menu-item" data-action="show-all"><span class="fwh-item-icon"><i class="fa-solid fa-eye"></i></span><span class="fwh-item-name">全部显示</span></div>
      <div class="fwh-menu-item" data-action="settings"><span class="fwh-item-icon"><i class="fa-solid fa-gear"></i></span><span class="fwh-item-name">打开设置</span></div>`;

    menu.innerHTML = html;

    menu.querySelectorAll('[data-idx]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const win = settings.windows[Number(el.dataset.idx)];
        if (win) toggleWindow(win);
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
        candidates.push({
          selector,
          text: (el.innerText || el.getAttribute('title') || '').slice(0, 24).trim(),
          z,
        });
      });
      candidates.sort((a, b) => b.z - a.z);
      if (!candidates.length) {
        result.innerHTML = '<div class="fwh-hint">未发现候选</div>';
        return;
      }
      result.innerHTML =
        '<div class="fwh-hint">点击添加：</div>' +
        candidates
          .slice(0, 25)
          .map(
            (c) =>
              `<div class="fwh-scan-item" data-s="${escapeHtml(c.selector)}" data-n="${escapeHtml(c.text || c.selector)}">
                <code>${escapeHtml(c.selector)}</code> <span style="opacity:.6">z=${c.z}</span> ${c.text ? escapeHtml(c.text) : ''}
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
          settings.windows.push({ name: item.dataset.n || sel, selector: sel, hidden: false });
          if (settings.autoHide) hideWindow(settings.windows[settings.windows.length - 1]);
          saveSettings(settings);
          renderList();
          renderMenu();
          toastr?.success?.('已添加');
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
    if (settings.autoHide && settings.windows.length) {
      settings.windows.forEach((w) => {
        if (w.hidden !== false) hideWindow(w);
      });
      saveSettings(settings);
      renderMenu();
    }
    console.log('[悬浮窗聚合助手] 已启动');
  }

  $(() => {
    // 等其他插件渲染完
    setTimeout(init, 1200);
  });

  $(window).on('pagehide', () => {
    // 关闭脚本时恢复显示，避免残留隐藏
    try {
      settings.windows.forEach(showWindow);
      destroyFab();
      parentDoc.getElementById('fwh-settings-modal')?.remove();
    } catch {}
  });
})();
