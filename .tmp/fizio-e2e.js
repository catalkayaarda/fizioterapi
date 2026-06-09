const { PrismaClient } = require('../packages/db/node_modules/@prisma/client');
const base = 'http://127.0.0.1:3001';
const stamp = Date.now();
const prisma = new PrismaClient();
let passCount = 0;
function log(name) { passCount++; console.log('PASS', name); }
function assert(condition, message) { if (!condition) throw new Error(message); }
async function req(path, { token, method = 'GET', body, headers = {} } = {}) {
  const h = new Headers(headers);
  if (token) h.set('authorization', 'Bearer ' + token);
  let payload = body;
  if (body && !(body instanceof FormData)) { h.set('content-type', 'application/json'); payload = JSON.stringify(body); }
  const res = await fetch(base + path, { method, headers: h, body: payload });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || res.statusText;
    const error = new Error(`${method} ${path} -> ${res.status}: ${msg}`);
    error.status = res.status; error.body = data; throw error;
  }
  return data;
}
async function expectFail(name, fn) {
  try { await fn(); throw new Error(name + ' beklenen hatayı vermedi'); }
  catch (e) { if (e.message.includes('beklenen hatayı vermedi')) throw e; log(name + ' hata kontrolü'); return e; }
}
async function register(role, label) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || role.toLowerCase();
  return req('/auth/register', { method: 'POST', body: { email: `${slug}-${stamp}@example.com`, password: 'Password123!', name: label, role } });
}
async function upload(token, type, name) {
  const fd = new FormData();
  fd.set('type', type);
  fd.set('file', new Blob([`${type} test belgesi`], { type: 'text/plain' }), name);
  return req('/therapists/me/documents', { token, method: 'POST', body: fd });
}
async function createSlot(token, offsetHours = 48) {
  const starts = new Date(Date.now() + offsetHours * 3600000);
  const ends = new Date(starts.getTime() + 3600000);
  return req('/therapists/me/slots', { token, method: 'POST', body: { startsAt: starts.toISOString(), endsAt: ends.toISOString() } });
}
async function completeOne(patientToken, therapistToken, pkgId, offset) {
  const slot = await createSlot(therapistToken, offset);
  const appointment = await req('/appointments/requests', { token: patientToken, method: 'POST', body: { packageId: pkgId, slotId: slot.id } });
  await req('/appointments/' + appointment.id + '/confirm', { token: therapistToken, method: 'PATCH', body: { videoLink: 'https://meet.example.com/fizioterapi-e2e' } });
  return req('/appointments/' + appointment.id + '/complete', { token: therapistToken, method: 'PATCH', body: {} });
}
(async () => {
  try {
    assert((await req('/health')).ok === true, 'health başarısız'); log('health');
    const treatmentTypes = await req('/catalog/treatment-types');
    assert(treatmentTypes.length >= 8, 'tedavi türleri eksik'); log('tedavi türü kataloğu');
    const primaryType = treatmentTypes[0];

    const admin = await req('/auth/login', { method: 'POST', body: { email: 'admin@fizioterapi.local', password: 'Admin12345!' } });
    assert(admin.user.role === 'ADMIN', 'admin login rolü hatalı'); log('admin login');
    const patient = await register('PATIENT', 'Hasta E2E'); log('hasta kayıt');
    const patient2 = await register('PATIENT', 'Hasta E2E İkinci'); log('ikinci hasta kayıt');
    const therapist = await register('THERAPIST', 'Fzt. E2E Terapist'); log('terapist kayıt');
    assert((await req('/users/admin-only', { token: patient.accessToken }).catch(e => e)).status === 403, 'role guard hasta için 403 dönmedi'); log('role guard');

    await req('/therapists/me', { token: therapist.accessToken }); log('terapist profil oku');
    await req('/therapists/me', { token: therapist.accessToken, method: 'PATCH', body: { fullName: 'Fzt. E2E Terapist', bio: 'E2E test biyografisi' } }); log('terapist profil güncelle');
    await upload(therapist.accessToken, 'DIPLOMA', 'diploma.txt');
    await upload(therapist.accessToken, 'LICENSE', 'lisans.txt');
    log('belge yükleme');
    await expectFail('onaysız paket oluşturma', () => req('/therapists/me/packages', { token: therapist.accessToken, method: 'POST', body: { name: 'Onaysız Paket', sessionCount: 1, price: 1000, mode: 'ONLINE', treatmentTypeId: primaryType.id } }));

    const pending = await req('/admin/therapists/pending', { token: admin.accessToken });
    const pendingProfile = pending.find(p => p.user?.email === therapist.user.email);
    assert(pendingProfile, 'bekleyen terapist listesinde yok'); log('admin bekleyen terapist listesi');
    const docs = await req('/admin/therapists/' + pendingProfile.id + '/documents', { token: admin.accessToken });
    assert((docs.documents || docs).length >= 2, 'belgeler listelenmedi'); log('admin belge görme');
    const approved = await req('/admin/therapists/' + pendingProfile.id + '/review', { token: admin.accessToken, method: 'PATCH', body: { status: 'APPROVED' } });
    assert(approved.status === 'APPROVED' && approved.iyzicoSubMerchantId, 'terapist onayı/submerchant başarısız'); log('admin onay + iyzico submerchant');

    const rejectedTherapist = await register('THERAPIST', 'Fzt. Reddedilecek');
    const rejectedPending = (await req('/admin/therapists/pending', { token: admin.accessToken })).find(p => p.user?.email === rejectedTherapist.user.email);
    await req('/admin/therapists/' + rejectedPending.id + '/review', { token: admin.accessToken, method: 'PATCH', body: { status: 'REJECTED', rejectionReason: 'E2E ret testi' } });
    log('admin red akışı');

    await req('/therapists/me/specialties', { token: therapist.accessToken, method: 'PATCH', body: { treatmentTypeIds: [primaryType.id] } }); log('uzmanlık seçimi');
    const pkg = await req('/therapists/me/packages', { token: therapist.accessToken, method: 'POST', body: { name: 'E2E 5 Seans Paketi', sessionCount: 5, price: 1500, mode: 'ONLINE', treatmentTypeId: primaryType.id } }); log('paket oluşturma');
    const extraPkg = await req('/therapists/me/packages', { token: therapist.accessToken, method: 'POST', body: { name: 'Silinecek Paket', sessionCount: 1, price: 600, mode: 'PHYSICAL', treatmentTypeId: primaryType.id } });
    await req('/therapists/me/packages/' + extraPkg.id, { token: therapist.accessToken, method: 'PATCH', body: { name: 'Güncellenen Paket', sessionCount: 2, price: 700, mode: 'BOTH', treatmentTypeId: primaryType.id } }); log('paket güncelleme');
    await req('/therapists/me/packages/' + extraPkg.id, { token: therapist.accessToken, method: 'DELETE' }); log('paket silme');
    const extraSlot = await createSlot(therapist.accessToken, 30);
    await req('/therapists/me/slots/' + extraSlot.id, { token: therapist.accessToken, method: 'DELETE' }); log('slot silme');

    const conflictSlot = await createSlot(therapist.accessToken, 50); log('slot oluşturma');
    const attempts = await Promise.allSettled([
      req('/appointments/requests', { token: patient.accessToken, method: 'POST', body: { packageId: pkg.id, slotId: conflictSlot.id } }),
      req('/appointments/requests', { token: patient2.accessToken, method: 'POST', body: { packageId: pkg.id, slotId: conflictSlot.id } })
    ]);
    assert(attempts.filter(a => a.status === 'fulfilled').length === 1 && attempts.filter(a => a.status === 'rejected').length === 1, 'eşzamanlı slot koruması beklenen gibi değil'); log('eşzamanlı slot koruması');
    const firstAppointment = attempts.find(a => a.status === 'fulfilled').value;
    const incoming = await req('/appointments/incoming', { token: therapist.accessToken });
    assert(incoming.some(a => a.id === firstAppointment.id), 'gelen talep görünmüyor'); log('gelen talepler');
    const confirmed = await req('/appointments/' + firstAppointment.id + '/confirm', { token: therapist.accessToken, method: 'PATCH', body: { videoLink: 'https://meet.example.com/fizioterapi-e2e' } });
    assert(confirmed.status === 'CONFIRMED', 'randevu onaylanmadı'); log('randevu onayı');
    const completed = await req('/appointments/' + firstAppointment.id + '/complete', { token: therapist.accessToken, method: 'PATCH', body: {} });
    assert(completed.status === 'COMPLETED', 'randevu tamamlanmadı'); log('randevu tamamlama');

    for (let i = 0; i < 4; i++) await completeOne(patient.accessToken, therapist.accessToken, pkg.id, 60 + i * 2);
    const loyalty = await req('/users/loyalty', { token: patient.accessToken });
    assert(loyalty.completedAppointments >= 5 && loyalty.loyaltyTier === 'SILVER' && loyalty.cancellationCredits >= 2, 'hasta kademe/kredi güncellemesi hatalı'); log('hasta kademe ve kredi');
    const therapistProfile = await req('/therapists/me', { token: therapist.accessToken });
    assert(therapistProfile.completedAppointments >= 5 && therapistProfile.loyaltyTier === 'SILVER' && String(therapistProfile.commissionRate).startsWith('0.18'), 'terapist kademe/komisyon hatalı'); log('terapist kademe ve komisyon');

    const search = await req('/marketplace/therapists?treatmentType=' + encodeURIComponent(primaryType.slug) + '&mode=ONLINE&minPrice=100&maxPrice=3000');
    assert(search.some(t => t.id === pendingProfile.id) && !search.some(t => t.status !== 'APPROVED'), 'keşif filtresi/onay kuralı hatalı'); log('terapist arama filtreleri');
    const detail = await req('/marketplace/therapists/' + pendingProfile.id);
    assert(detail.packages?.length && detail.specialties?.length, 'terapist detay eksik'); log('terapist detay');
    await req('/marketplace/therapists/' + pendingProfile.id + '/reviews', { token: patient.accessToken, method: 'POST', body: { rating: 5, comment: 'E2E yorumu' } }); log('yorum bırakma');

    const questions = await req('/assessment/questions');
    assert(questions.length >= 6, 'test soruları eksik'); log('yönlendirme testi soruları');
    const result = await req('/assessment/results', { token: patient.accessToken, method: 'POST', body: { optionIds: questions.map(q => q.options[0].id) } });
    assert(result.recommendedTreatmentType && result.disclaimer?.includes('tıbbi tavsiye değildir'), 'test sonucu/uyarı eksik'); log('yönlendirme testi sonucu');

    const cancelSlot = await createSlot(therapist.accessToken, 80);
    const cancelAppt = await req('/appointments/requests', { token: patient.accessToken, method: 'POST', body: { packageId: pkg.id, slotId: cancelSlot.id } });
    await req('/appointments/' + cancelAppt.id + '/confirm', { token: therapist.accessToken, method: 'PATCH', body: { videoLink: 'https://meet.example.com/cancel' } });
    const patientCancelled = await req('/appointments/' + cancelAppt.id + '/cancel/patient', { token: patient.accessToken, method: 'PATCH', body: { reason: 'E2E hasta iptali' } });
    assert(patientCancelled.status === 'CANCELLED' && patientCancelled.cancelledBy === 'PATIENT', 'hasta iptali hatalı'); log('hasta iptali');

    const therapistCancelSlot = await createSlot(therapist.accessToken, 90);
    const therapistCancelAppt = await req('/appointments/requests', { token: patient2.accessToken, method: 'POST', body: { packageId: pkg.id, slotId: therapistCancelSlot.id } });
    const therapistCancelled = await req('/appointments/' + therapistCancelAppt.id + '/cancel/therapist', { token: therapist.accessToken, method: 'PATCH', body: { reason: 'E2E terapist iptali' } });
    assert(therapistCancelled.status === 'CANCELLED' && therapistCancelled.cancelledBy === 'THERAPIST', 'terapist iptali hatalı'); log('terapist iptali');

    const expirySlot = await createSlot(therapist.accessToken, 100);
    const expiryAppt = await req('/appointments/requests', { token: patient2.accessToken, method: 'POST', body: { packageId: pkg.id, slotId: expirySlot.id } });
    await prisma.appointment.update({ where: { id: expiryAppt.id }, data: { autoExpireAt: new Date(Date.now() - 60000) } });
    const expired = await req('/appointments/expire-now', { token: admin.accessToken, method: 'POST', body: {} });
    assert(expired.expiredCount >= 1, 'expiry çalışmadı'); log('24 saat expiry');

    console.log(`OK ${passCount} kontrol geçti`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => { console.error('FAIL', error.message); if (error.body) console.error(JSON.stringify(error.body)); process.exit(1); });
