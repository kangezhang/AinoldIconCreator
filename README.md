# Ainold Icon Creator

一个跨平台的图标生成工具，支持生成 Windows (.ico) 和 macOS (.icns) 格式的图标文件。

## 功能特性

- 🖼️ 支持拖拽或选择图片上传
- ✂️ 可视化裁剪工具（自动保持正方形）
- 👀 实时预览多种尺寸
- 💾 一键生成 .ico 和 .icns 格式
- 🎨 现代化的 UI 界面

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建项目
npm run build
```

## 打包

```bash
# 打包当前平台
npm run package

# 打包 Windows 版本
npm run package:win

# 打包 macOS 版本
npm run package:mac
```

## 技术栈

- Electron
- React
- TypeScript
- Tailwind CSS
- Vite
- Sharp (图片处理)
- png2icons (图标生成)

## 使用说明

1. 启动应用后，拖拽或选择一张图片
2. 使用鼠标调整裁剪区域大小
3. 预览不同尺寸的效果
4. 点击"生成图标"按钮
5. 选择保存位置，自动生成 .ico 和 .icns 文件

## License

MIT
