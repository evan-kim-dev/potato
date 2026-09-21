# 브랜치

기본: **`main`**

| 용도 | 브랜치 |
|------|--------|
| 프로덕션 / 기본 | `main` |
| 큰 기능 | `feature/<짧은이름>` → PR → `main` |
| 급한 수정 | `fix/<짧은이름>` → PR → `main` |

```bash
git switch main
git pull
git switch -c feature/quiet-gems
# …작업 후 PR
```

배포는 GitHub Pages가 아니라 **`web/` 호스팅**(예: Vercel)을 기준으로 합니다.
