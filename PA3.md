# PA#3 — Prototype with the LLM feature running

## Thông tin nhóm

| MSSV | Họ và tên |
| --- | --- |
| 23120319 | Trương Thành Phát |
| 23120327 | Thái Thiên Phú |
| 23120380 | Huỳnh Lê Minh Triết |

## Link deployment

[ĐỂ TRỐNG — sẽ điền sau khi deploy]

## Tài khoản test

| Vai trò | Token | Username |
| --- | --- | --- |
| Admin | admin-token | admin_root |
| TA Lớp 1 | ta-class-1 | ta_instructor_1 |
| TA Lớp 2 | ta-class-2 | ta_instructor_2 |
| Sinh viên 1 | student-token | student_user_1 |
| Sinh viên 2 | student-token-2 | student_user_2 |

## Quyền xem trước Publish (Tiêu chí 5)

Theo [FAQ-08 của Product Owners (2026-10-25)](docs/FAQ.md#faq-08), trước khi TA Publish, sinh viên chỉ thấy trạng thái nộp bài và kết quả chấm test; kết quả soát ràng buộc của cả luật cứng lẫn mô hình (phán quyết, bằng chứng, khoản trừ) đều ẩn. [FAQ-02](docs/FAQ.md#faq-02) quy định không hiển thị input/output của test. Route `GET /api/v1/submissions/:submissionId` dùng danh sách trường cho phép để giữ kín dữ liệu soát và dữ liệu test gốc.

## Link CI run

[ĐỂ TRỐNG — sẽ điền sau khi CI xanh]

## Hướng dẫn chạy Docker Checker CLI

Thành viên 2 cung cấp Dockerfile độc lập tại `docker/Dockerfile.checker` và công cụ dòng lệnh `src/checker/cli.ts` phục vụ đánh giá độc lập theo Tiêu chí 6.

### 1. Build Docker image
```bash
docker build -t leetkob-checker -f docker/Dockerfile.checker .
```

### 2. Chạy chấm bộ test ở chế độ Offline (MODEL_OFF=1, không mạng)
```bash
docker run --network none -e MODEL_OFF=1 -v $(pwd)/custom-cases:/data leetkob-checker --dataset /data --out /data/predictions.jsonl
```

### 3. Chạy trực tiếp qua Node/npm (Local development)
```bash
# Chạy với MODEL_OFF=1 (Hard rules only, semantic -> unsure, 0 wrongful deductions)
MODEL_OFF=1 npm run checker -- --dataset custom-cases --out custom-cases/predictions.jsonl

# Chạy với mô hình AI thật (yêu cầu MODEL_API_KEY trong file .env)
npm run checker -- --dataset custom-cases --out custom-cases/predictions.jsonl
```

## Link video demo

[ĐỂ TRỐNG — sẽ quay sau]
