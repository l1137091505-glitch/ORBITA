# ORBITAL

ORBITAL is a native BOT staking dashboard presented as a bright orbital-control console. Users can deposit BOT, watch fixed-rate rewards accrue, claim rewards, compound them, and withdraw principal.

## Included

- Original React/Vite interface with responsive control-console layout.
- Wallet connection and live account/network change handling.
- Self-contained Solidity contract with deposits, withdrawals, claims, compounding, and an explicit reward reserve.
- Preview mode when no contract address is configured.
- Vercel SPA rewrites and Chinese deployment guide.

## Safety model

The contract uses a fixed 12.8% APR and can only pay rewards that have been separately funded into its reward reserve. Principal and reward reserves are tracked independently. The project has not received a professional audit; test with small values.

See `DEPLOY-ZH.md` for deployment instructions.

