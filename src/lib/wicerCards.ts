// Wicer Card — bộ thẻ cảm hứng/văn hoá mặc định (nạp vào DB qua seed).
// Nội dung theo hướng "phản tư + hành động", KHÔNG đại ngôn (né backfire), KHÔNG bói toán.
// Admin có thể thêm/sửa/tắt thẻ ở Console (bước 6).

export interface CardSeed {
  message: string;
  category: string; // Biết ơn | Sức khoẻ | Văn hoá | Cải tiến
  emoji: string;
  rarity: "common" | "rare" | "legendary";
  rewardKhoai: number;
}

export const DEFAULT_DECK: CardSeed[] = [
  // Biết ơn (dẫn sang WiThanks)
  { message: "Hôm nay, ai là người xứng đáng nhận một lời cảm ơn của bạn?", category: "Biết ơn", emoji: "🥔", rarity: "common", rewardKhoai: 0 },
  { message: "Một đồng nghiệp đã giúp bạn tuần này — hãy nói với họ điều đó.", category: "Biết ơn", emoji: "🤝", rarity: "common", rewardKhoai: 0 },
  { message: "Ghi nhận điều nhỏ: một tin nhắn, một nụ cười, một lần được giúp đỡ.", category: "Biết ơn", emoji: "💌", rarity: "common", rewardKhoai: 0 },

  // Sức khoẻ (dẫn sang Move)
  { message: "Đứng dậy đi bộ 5 phút thôi — cơ thể bạn xứng đáng được nghỉ.", category: "Sức khoẻ", emoji: "🌿", rarity: "rare", rewardKhoai: 5 },
  { message: "Uống một cốc nước ngay bây giờ. Việc nhỏ, khác biệt lớn.", category: "Sức khoẻ", emoji: "💧", rarity: "common", rewardKhoai: 0 },
  { message: "Hít thở sâu 3 lần trước cuộc họp tiếp theo.", category: "Sức khoẻ", emoji: "🫁", rarity: "common", rewardKhoai: 0 },

  // Văn hoá Wicom
  { message: "Điều nhỏ tạo nên văn hoá lớn.", category: "Văn hoá", emoji: "✨", rarity: "common", rewardKhoai: 0 },
  { message: "Chính sách rõ ràng để mỗi người tự tin làm điều đúng.", category: "Văn hoá", emoji: "🧭", rarity: "common", rewardKhoai: 0 },
  { message: "Một Wicom mạnh được xây từ những đồng đội tin nhau.", category: "Văn hoá", emoji: "🏛️", rarity: "rare", rewardKhoai: 5 },

  // Tự-trắc-ẩn (compassionate — hiệu quả hơn "tôi giỏi nhất")
  { message: "Việc này khó thật. Bạn đã cố gắng, và điều đó đáng ghi nhận.", category: "Sức khoẻ", emoji: "🤍", rarity: "common", rewardKhoai: 0 },
  { message: "Không sao nếu hôm nay chậm hơn — ngày mai vẫn ở đó.", category: "Sức khoẻ", emoji: "🌱", rarity: "common", rewardKhoai: 0 },

  // Cải tiến (dẫn sang WiGrow — sắp ra mắt)
  { message: "Một việc nhỏ bạn có thể làm gọn hơn hôm nay là gì?", category: "Cải tiến", emoji: "💡", rarity: "common", rewardKhoai: 0 },

  // Huyền thoại (hiếm nhất — thưởng nhiều)
  { message: "Bạn vừa lật trúng thẻ Huyền thoại! Một ngày tốt lành đang chờ.", category: "Văn hoá", emoji: "🌟", rarity: "legendary", rewardKhoai: 15 },
];

export const RARITY_LABEL: Record<string, string> = {
  common: "Thường",
  rare: "Hiếm",
  legendary: "Huyền thoại",
};
