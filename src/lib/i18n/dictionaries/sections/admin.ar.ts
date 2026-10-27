import type adminEn from "./admin.en";

/** Admin area strings (Arabic). */
const adminAr: { [K in keyof typeof adminEn]: string } = {
  title: "الإدارة",
  dashboard: "لوحة المعلومات",
  forbidden: "هذه الصفحة متاحة للمشرفين فقط.",
};

export default adminAr;
