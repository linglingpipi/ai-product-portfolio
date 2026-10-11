# 王源庆 AI 产品与应用作品集

北京邮电大学本科生的 AI 产品与应用项目案例，收录零橄触式橄榄球训练助手与 AI Workbench。个人贡献、设计决策、可查看证据与验证范围分别标明。

网站：https://linglingpipi.github.io/ai-product-portfolio/

## 本地预览

使用 Node.js 22：

```sh
node scripts/build.mjs
node scripts/check.mjs
node scripts/test-stage.mjs
node scripts/serve.mjs
```

本地地址：http://127.0.0.1:4173/ 。修改 content/portfolio.json 后重新构建。检查脚本核对生成文件白名单、内部链接及部分文案；真实浏览器视觉检查另行完成。

## 发布

GitHub Pages 使用 GitHub Actions；Deploy portfolio to GitHub Pages 工作流仅手动触发。内容与素材公开范围需在每次发布前复核。

本仓库只包含公开作品集素材及构建逻辑，不包含项目完整源码、公司内部资料或个人知识库。GSAP 版本与许可见 assets/gsap-NOTICE.txt。未经实际测试的模型能力和用户效果不作为已验证成果。
