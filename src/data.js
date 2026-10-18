// Data contoh. Ganti dengan panggilan API saat endpoint chat sudah tersedia.
export const LANGS = { id: 'Indonesia', en: 'English', 'zh-CN': '中文' };
export const TAG = { id: 'ID', en: 'EN', 'zh-CN': '中文' };

export const conversations = [
  { id: 'gudang', title: 'Tim Gudang', type: 'group', members: 5, unread: 3 },
  { id: 'liwei', title: 'Li Wei', type: 'direct', initials: 'LW', color: '#E8D9C3' },
  { id: 'budi', title: 'Budi Santoso', type: 'direct', initials: 'BS', color: '#CFE0EE' },
  { id: 'pengadaan', title: 'Pengadaan', type: 'group', members: 4 },
];

export const seedMessages = {
  gudang: [
    { id: 1, from: 'Li Wei', initials: 'LW', color: '#E8D9C3', time: '09:12', lang: 'zh-CN',
      text: { 'zh-CN': '货物已到仓库，请确认收到的托盘数量。',
              id: 'Barang sudah tiba di gudang, mohon konfirmasi jumlah pallet yang diterima.',
              en: 'The goods have arrived at the warehouse. Please confirm the pallet count.' } },
    { id: 2, from: 'Rina', me: true, time: '09:14', lang: 'id',
      text: { id: 'Siap, saya cek sekarang. Apakah sudah termasuk pallet tambahan dari Surabaya?',
              en: 'On it, checking now. Does that include the extra pallets from Surabaya?',
              'zh-CN': '好的，我现在核对。是否包括从泗水来的额外托盘？' } },
    { id: 3, from: 'Budi Santoso', initials: 'BS', color: '#CFE0EE', time: '09:15', lang: 'id',
      text: { id: 'Total 48 pallet, 2 di antaranya rusak. Foto menyusul.',
              en: '48 pallets in total, 2 of them damaged. Photos to follow.',
              'zh-CN': '共48个托盘，其中2个损坏，照片稍后发送。' } },
    { id: 4, from: 'Amy Koh', initials: 'AK', color: '#D8E8D0', time: '09:16', lang: 'en',
      text: { en: 'I checked the delivery note, everything matches.',
              id: 'Saya sudah mengecek surat jalan, semuanya sesuai.',
              'zh-CN': '我核对了送货单，一切吻合。' } },
  ],
  liwei: [], budi: [], pengadaan: [],
};

export const glossary = [
  ['pallet', '托盘', 'pallet'],
  ['surat jalan', '送货单', 'delivery note'],
  ['gudang', '仓库', 'warehouse'],
];
