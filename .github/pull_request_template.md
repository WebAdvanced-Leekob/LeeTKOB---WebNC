## 1. Vấn đề & Giải pháp (Problem & Solution)

### Vấn đề (Problem)
<!-- Mô tả bài toán cần giải quyết, lỗi cần sửa hoặc tính năng mới cần bổ sung -->

### Giải pháp (Solution)
<!-- Nêu rõ cách tiếp cận kỹ thuật và các thay đổi chính trong mã nguồn để giải quyết vấn đề trên -->

---

## 2. Minh chứng kiểm thử (Test Evidence)

### Kết quả kiểm thử tự động (Automated Tests)
<!-- Dán kết quả chạy npm test / vitest hoặc số lượng test suite vượt qua -->
```text
Test Files: ... passed
Tests:      ... passed
```

### Kết quả đánh giá / Kiểm tra thực tế (Evaluation / Manual Runs)
<!-- Dán kết quả chạy eval.mjs, Docker, hoặc log kiểm toán call_log nếu có -->
```text
```

---

## 3. Phân hệ & Tiêu chí liên quan (Rubric Alignment)
<!-- Đánh dấu vào các tiêu chí thuộc phạm vi của PR này -->
- [ ] Tiêu chí 1: Prototype triển khai công khai và luồng Web hoàn chỉnh
- [ ] Tiêu chí 2: Sandbox an toàn, hàng đợi và worker idempotent
- [ ] Tiêu chí 3: Hard rules nhận diện cú pháp và tránh phạt nhầm
- [ ] Tiêu chí 4: LLM hoạt động, bảo vệ dữ liệu và ghi nhận chi phí
- [ ] Tiêu chí 5: Guardrails, review queue và human gate
- [ ] Tiêu chí 6: Docker Checker CLI và đánh giá độc lập
- [ ] Tiêu chí 7: Tests first và commit tách biệt theo từng phần
- [ ] Tiêu chí 8: AI-LOG minh bạch, có đối soát

---

## 4. Checklist cổng chất lượng (Quality Gate)
<!-- Xác nhận tất cả các kiểm tra sau đã vượt qua trên máy cục bộ trước khi mở PR -->
- [ ] `npm run format:check` (Prettier code style)
- [ ] `npm run lint` (ESLint 0 errors)
- [ ] `npm run typecheck` (TypeScript 0 errors)
- [ ] `npm run test` (Toàn bộ test suites đều pass)

---

## 5. Hướng dẫn Merge (Merge Instructions)
- [ ] TUYỆT ĐỐI KHÔNG SQUASH MERGE (bắt buộc theo Tiêu chí 7 để bảo toàn lịch sử TDD cá nhân).
- [ ] Chọn "Rebase and merge" hoặc "Create a merge commit".
