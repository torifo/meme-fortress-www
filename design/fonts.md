# フォント設定（serendipity-encount feat/comic-ui より）

## CSS変数 → Google Fonts 対応表

| CSS変数 | フォント名 | 用途 |
| :--- | :--- | :--- |
| `--font-sans` | Noto Sans JP (400/600/700/800/900) | 本文・UI全般 |
| `--font-display` | DotGothic16 (400) | セクション見出し・ドット風デジタル文字 |
| `--font-impact` | Dela Gothic One (400) | 大見出し・インパクト系テキスト（`-webkit-text-stroke` 縁取りと相性◎） |
| `--font-bubble` | Hachi Maru Pop (400) | 吹き出し・カジュアル手書き風 |

## Next.js での読み込み例（参考）

```ts
import { Noto_Sans_JP, DotGothic16, Dela_Gothic_One, Hachi_Maru_Pop } from "next/font/google";
```

## Tauri / HTML での読み込み例

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700;800;900&family=DotGothic16&family=Dela+Gothic+One&family=Hachi+Maru+Pop&display=swap" rel="stylesheet">
```

```css
:root {
  --font-sans: "Noto Sans JP", "Hiragino Sans", sans-serif;
  --font-display: "DotGothic16", sans-serif;
  --font-impact: "Dela Gothic One", sans-serif;
  --font-bubble: "Hachi Maru Pop", sans-serif;
}
```
