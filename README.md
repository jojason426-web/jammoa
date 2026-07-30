# 잼모아

`jammoa.com`용 게시판형 유머 사이트입니다. Cloudflare Workers, D1, R2, Queues, Cron Triggers 기반으로 구성했습니다.

## 포함된 기능

- React/Vite 게시판 UI와 초기 게시글 100개
- 게시글 목록, 상세, 초기 데이터 설정, 큐 등록, 예약 수집을 처리하는 Cloudflare Worker API
- `migrations/0001_schema.sql` D1 스키마
- 허용된 출처 이미지를 가져와 `webp`로 변환하고 R2에 업로드하는 스크립트
- Cloudflare 배포용 GitHub Actions 워크플로우

## 로컬 개발

```bash
npm install
npm run dev
```

## Cloudflare 설정

```bash
npx wrangler login
npx wrangler d1 create jammoa-db
npx wrangler r2 bucket create jammoa-images
npx wrangler queues create jammoa-crawl
```

생성된 D1 데이터베이스 ID를 `wrangler.jsonc`에 넣은 뒤 실행합니다.

```bash
npm run db:migrate
npm run build
npm run cf:deploy
```

배포 후 초기 게시글 100개를 넣습니다.

```bash
curl -X POST https://jammoa.com/api/seed
```

## R2 webp 가져오기

`.env.example`을 기준으로 `.env`를 만든 뒤 실행합니다.

```bash
npm run import:source -- https://example.com/allowed-post
```

크롤링과 재사용을 허용한 출처만 사용해야 합니다. 가져오기 스크립트는 `robots.txt`를 확인하고, 메타데이터와 이미지 후보를 추출한 뒤 이미지를 `webp`로 변환해 R2에 업로드합니다.

## GitHub 연동

1. GitHub 저장소를 만듭니다.
2. 이 폴더를 `main` 브랜치로 푸시합니다.
3. 저장소 시크릿을 추가합니다.
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. `.github/workflows/cloudflare.yml` 워크플로우가 `main` 푸시마다 배포합니다.
