# ORBITAL 部署步骤

1. 在 GitHub 新建公开仓库 `orbital-vault`，不要额外创建 README、License 或 `.gitignore`。
2. 上传本项目解压后的全部内容。
3. 在 Vercel 导入仓库，Root Directory 选择 `frontend`，Framework 选择 Vite。
4. 先完成一次预览部署。
5. 在 Remix 中新建 `OrbitalVault.sol`，复制 `contracts/src/OrbitalVault.sol` 的全部内容并使用 Solidity 0.8.24 编译。
6. 钱包切换到目标 EVM 网络，部署 `OrbitalVault`；构造函数没有参数。
7. 复制完整合约地址，在 Vercel 添加 Config 环境变量：

```text
VITE_ORBITAL_ADDRESS=0x完整合约地址
```

8. 重新部署 Production，且不要使用旧的 Build Cache。
9. 若需要支付收益，先用部署者或其他钱包调用合约的 `fundRewards`，向奖励储备注入少量 BOT。

合约地址是公开信息，不需要设为 Secret。绝对不要上传钱包私钥。项目未经专业审计，请先使用少量资金测试。

