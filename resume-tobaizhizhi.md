# 姓名：待补充

**联系方式**：手机号 / 邮箱 / 微信（待补充）  
**GitHub**：https://github.com/tobaizhizhi  
**可到岗时间**：待补充  
**实习周期**：待补充  

## Boss 直聘一句话介绍

正在寻找 Web3 / AI 应用开发实习机会。项目中主要接触 TypeScript、Next.js、React、Solidity、Foundry、ethers、viem，完成过 AI + Web3 贡献结算系统，能在文档和 AI 工具辅助下完成前端页面、钱包交互、合约读写、Agent API 和基础智能合约开发，并理解、运行和调试自己提交的代码。

## 个人优势

- 有完整 Web3 项目实践：覆盖钱包连接、网络切换、合约读取、交易发送、EIP-712 签名、链上结算等流程。
- 有 AI 应用开发经验：能用 OpenAI 兼容 API 将自然语言、贡献证据等输入转换为结构化结果。
- 有智能合约开发基础：使用 Solidity / Foundry / OpenZeppelin 编写和测试合约，关注签名校验、防重复、防过期、重入保护等安全点。
- 学习和交付意愿强：公开仓库持续围绕 Web3、AI Agent、DApp 集成、Foundry 合约开发方向沉淀。

## 项目涉及技术

**较常使用**：TypeScript、Next.js、React、Tailwind CSS、ethers.js、viem、MetaMask、Node.js、Zod、Solidity 合约设计、Foundry / Foundry 测试、OpenZeppelin  
**项目中接触**：shadcn/ui、Cobo Agentic Wallet  
**正在学习**：更深智能合约安全、Agent 工作流编排、MCP SDK  
**工程能力**：能借助文档和 AI 工具完成需求拆解、代码实现、前后端联调、合约 ABI 交互和项目文档整理

## 项目经历

### CGHub 贡献结算 Agent

**项目链接**：https://github.com/tobaizhizhi/CGHUB  
**项目时间**：2026.06  
**项目类型**：AI + Web3 全栈个人项目  
**技术栈**：Next.js 14、React 18、TypeScript、Node.js、Solidity、Foundry、ethers、viem、Zod、OpenZeppelin、Cobo Agentic Wallet

CGHub 是一个面向 Hackathon、Grant、开源社区的 AI 贡献结算系统。贡献者提交证据后，AI Agent 按 rubric 评分，系统通过 Cobo Agentic Wallet 完成签名审批和受限链上执行，最后由 `ContributionPool` 合约按贡献分分配奖励。

**负责内容**

- 实现多角色前端页面，包括管理者、资金方 / 赞助方、贡献者和复盘视图。
- 编写 Node.js + TypeScript Agent API，处理贡献证据解析、AI 评分、风险标记、审批状态和链上执行流程。
- 编写 `ContributionPool.sol` 合约，支持创建 Round、注资、记录贡献分、finalize、claim 和 claimFor。
- 使用 EIP-712 typed data 设计贡献证明签名流程，并在合约中通过 ECDSA 验证 Agent 签名。
- 使用 Cobo Agentic Wallet 将签名权限和执行权限拆分，避免 Agent 直接拥有无限制链上操作能力。
- 使用 ethers / viem 完成合约读取、事件解析、交易数据构造和前端链上状态展示。

**项目亮点**

- 完成“证据提交 -> AI 评分 -> 风险审核 -> 签名 -> 上链记分 -> 按分领取”的端到端闭环。
- 合约中使用 `proofHash` 防重复提交，使用 `deadline` 防过期证明，使用 `nonReentrant` 保护领取流程。
- 项目文档较完整，包含 README、Proposal、Demo 视频、本地启动流程和 Sepolia 配置说明。

## 教育经历

**学校名称**：待补充  
**专业**：待补充  
**学历**：待补充  
**时间**：待补充  

## 可投递岗位关键词

Web3 前端实习、区块链开发实习、智能合约开发实习、AI 应用开发实习、前端开发实习、DApp 开发、Agent 应用开发、TypeScript 开发、Solidity 开发。
