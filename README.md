# BlockWorld

問題を解いてブロックと遊ぶ時間（最大3分）をためて、ブロックワールドで遊ぶ学習ゲームです。

- `index.html` / `app.js` / `style.css` … 最初の画面と、どんどん出る分数の問題（まちがえた問題はあとでもう一度出ます）
- `play/` … ブロックワールド（`game-src/` をビルドしたもの）
- `game-src/` … ブロックワールドのソース（Vite + TypeScript + Three.js）

2つの画面は、同じブラウザの localStorage（ブロックの持ち物と残り時間）で受け渡しています。

ブロックワールドを作り直すとき:

```sh
cd game-src && npm ci && npm run build   # dist/ ができるので、中身を play/ に置く
```
