# dsh-brand · 一键品牌替换

替换 DSH Web GUI 的品牌信息，方便各家二次开发分发自己的品牌：

- 商标 Logo（侧栏 + 新会话 Hero，支持图片 URL / Data URL / 文字 / Emoji）
- 产品名称（左上角侧栏）
- 版本徽标（侧栏名称旁的 badge）
- Hero 主标题（新会话页大字）
- Hero 徽标（如「预览版」）
- 一句话简介（Hero 副标题行）
- 浏览器标签页标题

所有字段留空即显示官方默认；停止/卸载插件后界面完全还原。

## 安装（使用者）

从 Git 仓库获取后：

```powershell
git clone <本仓库地址>
dsh plugin --profile web add <克隆下来的 dsh-brand 目录>
```

（若所用 CLI 版本支持 `github:` 规格，也可以直接
`dsh plugin --profile web add github:<owner>/<repo>`。）

包是纯手写 ESM、零依赖、免构建，`lib/` 即产物，无需 `npm install` / build。

安装会把这个包链接进 profile、合并 `cordis.patch.yml`（插入 `dsh-brand` 加载行）并热挂载。
装完刷新 http://127.0.0.1:3080 ；若未出现，重启 `dsh web` 一次。

## 使用

打开 **设置 → 品牌 Branding**，填写字段后点「保存并应用」，即时生效无需刷新；
「恢复默认」一键清空。

## 配置分发

配置保存在 `$DSH_HOME/dsh-brand.json`（默认 `C:\Users\<用户>\.dsh\dsh-brand.json`），
纯 JSON、跨工作区生效。二改部署只需随包分发这一个文件：

```json
{
  "name": "Acme Harness",
  "version": "v1.0.0",
  "headline": "探索未至之境",
  "badge": "预览版",
  "intro": "面向内部的智能体工作台",
  "logoText": "🐳",
  "logoUrl": "",
  "title": "Acme Harness"
}
```

| 字段 | 作用位置 |
| --- | --- |
| `name` | 侧栏产品名；未设 Logo 时取首字符做图标 |
| `version` | 侧栏名称旁的版本徽标 |
| `headline` | Hero 主标题（三项任一填写即接管 Hero 区） |
| `badge` | Hero 徽标 pill |
| `intro` | Hero 下方简介行 |
| `logoText` | 无图片时的文字/Emoji 商标 |
| `logoUrl` | 商标图片（`https://…` 或 `data:image/…`），优先于 `logoText` |
| `title` | 浏览器标签页标题 |

## 实现说明

- 走官方品牌 Slot：`sidebar.brand.mark`、`sidebar.brand.name`、`conversation.hero.brand.mark`，不碰 shell 其他区域。
- Hero 原生「主标题/徽标」是写死的 locale 文案、不可覆盖；本插件在接管时用一个 `:has()` 作用域样式隐藏原生两段文本，由 Hero mark 槽渲染整行自定义内容，卸载即还原。
- Host 半注册 `GET/PUT /api/dsh-brand/config` 读写配置文件；写入仅接受同源请求。
