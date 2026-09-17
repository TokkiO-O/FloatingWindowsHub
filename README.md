# 悬浮窗聚合助手

把其他插件的悬浮窗收纳到一个统一的悬浮球里。  
点击悬浮球 → 列表选择名称 → 显示/隐藏对应悬浮窗。

## 安装（自动更新）

1. 确保已安装 [酒馆助手](https://github.com/N0VI028/JS-Slash-Runner)
2. 酒馆助手 → 脚本库 → **全局脚本** → 新建脚本
3. 名称：`悬浮窗聚合助手`
4. 内容只写下面一行（把 `你的用户名` 和仓库名换成你自己的）：

```js
import 'https://testingcf.jsdelivr.net/gh/你的用户名/FloatingWindowsHub/dist/悬浮窗聚合助手/index.js'
```

5. （推荐）添加脚本按钮：`打开设置`、`扫描候选`、`全部显示`、`全部隐藏`
6. 启用脚本

### 固定版本（可选）

打 tag 后可用：

```js
import 'https://testingcf.jsdelivr.net/gh/你的用户名/FloatingWindowsHub@v1.0.0/dist/悬浮窗聚合助手/index.js'
```

## 功能

- 可拖拽紫色悬浮球（位置记住）
- 点击菜单管理已注册悬浮窗
- 互斥模式 / 启动自动收起
- 扫描页面候选悬浮元素一键添加
- 手动填写 CSS 选择器添加

## 仓库必须公开

jsDelivr 只能读取 **公开** GitHub 仓库。  
私密仓库无法用 jsDelivr 做自动更新。

## 更新方式

修改 `dist/悬浮窗聚合助手/index.js` 后 push 到 GitHub 即可。  
用户下次打开酒馆会拉取新版本（无 tag 的链接有缓存，紧急更新可打新 tag）。

## 许可

MIT
