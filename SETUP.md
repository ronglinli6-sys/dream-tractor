# 梦幻拖拉机项目搭建与运行说明

本文档说明如何从零搭建、导入、运行和调试本项目。

## 1. 项目结构

```text
dream-tractor/
├─ miniprogram/              微信小程序前端
│  ├─ pages/index/           首页
│  ├─ pages/room/            房间页
│  ├─ pages/game/            牌桌页
│  └─ assets/                扑克牌图片资源
├─ server/                   Node.js WebSocket 服务雏形
├─ shared/                   扑克牌、牌型、游戏状态逻辑
├─ package.json              Node.js 依赖与脚本
├─ project.config.json       微信开发者工具项目配置
├─ project.private.config.json 本机微信开发者工具私有配置
└─ project.private.config.log 私有配置的文本备份
```

## 2. 环境准备

需要安装：

1. Node.js
2. 微信开发者工具
3. Git

推荐 Node.js LTS 版本。检查命令：

```bash
node -v
npm -v
git --version
```

如果没有 Node.js，可以下载安装：

```text
https://nodejs.org/
```

如果使用 Windows 且已安装 Chocolatey，也可以执行：

```powershell
choco install nodejs-lts -y
```

## 3. 获取代码

从 GitHub 克隆：

```bash
git clone https://github.com/ronglinli6-sys/dream-tractor.git
cd dream-tractor
```

本仓库当前也包含 `node_modules`，通常可以直接运行。若依赖异常，重新安装：

```bash
npm install
```

## 4. 启动后端服务

后端是 WebSocket 服务雏形，默认端口 `8787`。

```bash
npm run server:dev
```

成功后会看到：

```text
梦幻拖拉机 WebSocket 服务已启动：ws://localhost:8787
```

当前小程序前端仍主要是本地演示流程，后端用于后续多人联机接入。

## 5. 导入微信小程序

打开微信开发者工具，选择：

```text
导入项目
```

项目目录选择仓库根目录：

```text
dream-tractor
```

不要选择 `miniprogram` 子目录，也不要选择 `node_modules`。

如果要求 AppID：

- 有正式小程序 AppID：填写正式 AppID。
- 只是本地演示：可选择测试号/游客模式，具体取决于微信开发者工具版本。

## 6. 本地编译预览

在微信开发者工具中点击：

```text
编译
```

可以从首页进入：

- 创建房间
- 加入演示房间
- 以庄家身份开始演示
- 以闲家身份开始演示

## 7. 真机调试

在微信开发者工具点击：

```text
真机调试
```

用手机微信扫码。

如果无法真机调试，检查：

1. 微信开发者工具是否已登录。
2. 当前微信号是否是该小程序开发者。
3. 小程序后台是否添加了开发成员。
4. 是否使用了真实 AppID。

开发成员添加位置：

```text
微信公众平台 -> 成员管理 -> 项目成员
```

微信公众平台：

```text
https://mp.weixin.qq.com
```

## 8. 牌局演示说明

### 庄家视角

房间页点击：

```text
以庄家身份开始演示
```

支持：

- 查看庄家暗牌
- 单开闲家
- 连续开多个闲家
- 通开剩余闲家
- 自罚
- 结束本轮开牌
- 洗牌发牌
- 剩余牌不足时自动换庄并重新洗牌

### 闲家视角

房间页点击：

```text
以闲家身份开始演示
```

支持：

- 默认暗牌背面，不直接显示
- 点击自己的暗牌后才看牌
- 看牌后头像状态变为“已看牌”
- 不看牌直接准备和叫酒，则保持“蒙牌”
- 选择叫酒数
- 模拟庄家开自己
- 模拟庄家开别人
- 模拟通开

## 9. 小程序包大小注意事项

真机调试有包大小限制。项目已经删除完整牌库源码目录，只保留实际使用的 54 张牌面图和牌背图。

如果再次下载扑克牌素材，请不要把完整素材仓库放进：

```text
miniprogram/assets
```

只保留实际使用的图片即可。

## 10. 常用命令

安装依赖：

```bash
npm install
```

类型检查：

```bash
npm run check
```

启动后端：

```bash
npm run server:dev
```

查看 Git 状态：

```bash
git status
```

## 11. 常见问题

### project.config.json 不是 UTF-8

确保 `project.config.json` 使用 UTF-8 编码。当前项目已处理。

### 真机调试提示 source size 超限

检查是否误把完整素材仓库、压缩包、大文件放进 `miniprogram/`。

### project.private.config.json 是否必须上传

它是微信开发者工具的本机私有配置。项目中保留了：

```text
project.private.config.json
project.private.config.log
```

其中 `.log` 是文本备份，便于查看或上传。

### node_modules 是否必须上传

通常不建议上传 `node_modules`，但当前仓库按要求已包含。若依赖损坏，仍建议执行：

```bash
npm install
```

## 12. 后续联机开发建议

当前小程序主要是演示版。若要真正多人联机，需要继续完成：

1. 小程序接入 WebSocket。
2. 后端统一洗牌、发牌、判定牌型。
3. 房间状态从前端本地模拟迁移到后端。
4. 增加微信登录。
5. 增加断线重连和房间恢复。
6. 部署后端到公网 HTTPS/WSS 域名。
