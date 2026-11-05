export interface BuiltinTemplate {
  /** Stable id, used to remember what was already installed. */
  id: string;
  title: string;
  markdown: string;
}

/** Bump when the content of a template changes and should be re-installed. */
export const BUILTIN_TEMPLATES_VERSION = 1;

export const VI_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'vi-journal',
    title: 'Nhật ký hằng ngày',
    markdown: `## Hôm nay
- Tâm trạng:
- Năng lượng (1–5):
- Thời tiết:

## Ba điều biết ơn
1.
2.
3.

## Ưu tiên hôm nay
- [ ] Việc quan trọng nhất
- [ ] Việc quan trọng thứ hai
- [ ] Việc quan trọng thứ ba

## Ghi chép trong ngày

## Nhìn lại cuối ngày
- Điều làm tốt:
- Điều cần cải thiện:
- Mai sẽ thử:
`,
  },
  {
    id: 'vi-expenses',
    title: 'Chi tiêu tháng',
    markdown: `## Tổng quan tháng
- Thu nhập:
- Tổng chi:
- Còn lại:
- Mục tiêu tiết kiệm:

## Sổ chi tiêu

| Ngày | Khoản chi | Danh mục | Số tiền (VND) | Ghi chú |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

## Ngân sách theo danh mục

| Danh mục | Ngân sách | Đã chi | Chênh lệch |
| --- | --- | --- | --- |
| Ăn uống |  |  |  |
| Đi lại |  |  |  |
| Nhà ở |  |  |  |
| Giải trí |  |  |  |
| Khác |  |  |  |

## Nhận xét cuối tháng
- Khoản chi bất ngờ:
- Có thể cắt giảm:
`,
  },
  {
    id: 'vi-okr',
    title: 'OKR theo quý',
    markdown: `## Mục tiêu (Objective)
Viết một câu truyền cảm hứng, định tính, đạt được trong quý này.

## Kết quả then chốt (Key Results)

### KR1:
- Chỉ số đo lường:
- Hiện tại → Mục tiêu:
- Tiến độ: 0%

### KR2:
- Chỉ số đo lường:
- Hiện tại → Mục tiêu:
- Tiến độ: 0%

### KR3:
- Chỉ số đo lường:
- Hiện tại → Mục tiêu:
- Tiến độ: 0%

## Hành động chính
- [ ] Hành động cho KR1
- [ ] Hành động cho KR2
- [ ] Hành động cho KR3

## Đánh giá giữa quý

## Tổng kết cuối quý
- Điểm tự chấm (0–1.0):
- Bài học:
`,
  },
  {
    id: 'vi-study',
    title: 'Ghi chép học tập',
    markdown: `## Thông tin bài học
- Môn / chủ đề:
- Nguồn (sách, khóa học, video):
- Ngày học:

## Mục tiêu bài học
-

## Ghi chú chính

## Câu hỏi tự kiểm tra
Mỗi câu hỏi viết một dòng, trả lời ở dòng dưới.

1. Câu hỏi:
   - Trả lời:
2. Câu hỏi:
   - Trả lời:

## Tóm tắt bằng lời của mình

## Lịch ôn tập
- [ ] Ôn lần 1 (sau 1 ngày)
- [ ] Ôn lần 2 (sau 3 ngày)
- [ ] Ôn lần 3 (sau 1 tuần)
- [ ] Ôn lần 4 (sau 1 tháng)
`,
  },
  {
    id: 'vi-meeting',
    title: 'Biên bản họp',
    markdown: `## Thông tin cuộc họp
- Chủ đề:
- Ngày giờ:
- Địa điểm / liên kết:
- Chủ trì:
- Thành phần tham dự:

## Mục tiêu cuộc họp
-

## Nội dung thảo luận
1.

## Quyết định
-

## Việc cần làm
- [ ] Việc 1 (người phụ trách)
- [ ] Việc 2 (người phụ trách)

## Câu hỏi còn mở
-

## Cuộc họp tiếp theo
- Thời gian:
- Nội dung chuẩn bị:
`,
  },
];
