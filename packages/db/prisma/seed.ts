import bcrypt from "bcrypt";
import { PackageMode, PrismaClient, Role, TherapistStatus } from "@prisma/client";

const prisma = new PrismaClient();

const treatmentTypes = [
  ["manuel-terapi", "Manuel Terapi", "Eklem, kas ve yumuşak doku odaklı manuel uygulamalar."],
  ["ortopedik-rehabilitasyon", "Ortopedik Rehabilitasyon", "Ameliyat, kırık, bağ ve kas-iskelet sistemi yaralanmaları sonrası rehabilitasyon."],
  ["norolojik-rehabilitasyon", "Nörolojik Rehabilitasyon", "İnme, MS, Parkinson ve sinir sistemi kaynaklı fonksiyon kayıpları için rehabilitasyon."],
  ["sporcu-fizyoterapisi", "Sporcu Fizyoterapisi", "Spor yaralanmaları, performans ve sahaya dönüş programları."],
  ["pediatrik", "Pediatrik", "Bebek ve çocuklarda motor gelişim ve fonksiyonel destek."],
  ["geriatrik", "Geriatrik", "Yaşlı bireylerde denge, kuvvet, mobilite ve düşme önleme çalışmaları."],
  ["kardiyopulmoner", "Kardiyopulmoner", "Kalp-akciğer kapasitesi, solunum egzersizleri ve efor toleransı çalışmaları."],
  ["pelvik-taban", "Pelvik Taban", "Pelvik taban disfonksiyonları, inkontinans ve doğum sonrası destek."],
  ["postur-skolyoz", "Postür/Skolyoz", "Postür bozuklukları ve skolyoz için egzersiz ve takip programları."]
] as const;

const questions = [
  {
    key: "main_complaint",
    text: "Ana şikayetiniz hangisine daha yakın?",
    options: [
      ["joint_pain", "Eklem/kas ağrısı", ["manuel-terapi", "ortopedik-rehabilitasyon"]],
      ["sport_injury", "Spor yaralanması", ["sporcu-fizyoterapisi", "ortopedik-rehabilitasyon"]],
      ["neurologic", "Nörolojik hastalık sonrası hareket güçlüğü", ["norolojik-rehabilitasyon"]],
      ["breathing", "Nefes darlığı veya efor kapasitesi düşüklüğü", ["kardiyopulmoner"]]
    ]
  },
  {
    key: "age_group",
    text: "Danışanın yaş grubu nedir?",
    options: [
      ["child", "Çocuk", ["pediatrik"]],
      ["adult", "Yetişkin", ["manuel-terapi"]],
      ["older_adult", "65 yaş ve üzeri", ["geriatrik"]]
    ]
  },
  {
    key: "surgery_history",
    text: "Son 12 ay içinde ortopedik operasyon geçirdiniz mi?",
    options: [
      ["yes", "Evet", ["ortopedik-rehabilitasyon"]],
      ["no", "Hayır", ["manuel-terapi"]]
    ]
  },
  {
    key: "posture",
    text: "Postür veya skolyoz takibi ihtiyacınız var mı?",
    options: [
      ["yes", "Evet", ["postur-skolyoz"]],
      ["no", "Hayır", []]
    ]
  },
  {
    key: "pelvic_symptoms",
    text: "Pelvik taban, idrar kaçırma veya doğum sonrası destek ihtiyacınız var mı?",
    options: [
      ["yes", "Evet", ["pelvik-taban"]],
      ["no", "Hayır", []]
    ]
  },
  {
    key: "balance",
    text: "Denge kaybı veya düşme korkusu yaşıyor musunuz?",
    options: [
      ["yes", "Evet", ["geriatrik", "norolojik-rehabilitasyon"]],
      ["no", "Hayır", []]
    ]
  },
  {
    key: "activity_goal",
    text: "Öncelikli hedefiniz nedir?",
    options: [
      ["return_sport", "Spora dönüş", ["sporcu-fizyoterapisi"]],
      ["daily_life", "Günlük yaşama daha rahat devam etmek", ["ortopedik-rehabilitasyon", "geriatrik"]],
      ["pain_relief", "Ağrının azalması", ["manuel-terapi"]]
    ]
  },
  {
    key: "respiratory_condition",
    text: "Kalp veya akciğer hastalığı nedeniyle egzersiz desteği gerekiyor mu?",
    options: [
      ["yes", "Evet", ["kardiyopulmoner"]],
      ["no", "Hayır", []]
    ]
  }
] as const;

async function main() {
  for (const [slug, name, description] of treatmentTypes) {
    await prisma.treatmentType.upsert({
      where: { slug },
      update: { name, description },
      create: { slug, name, description }
    });
  }

  for (const [index, question] of questions.entries()) {
    const createdQuestion = await prisma.assessmentQuestion.upsert({
      where: { key: question.key },
      update: { text: question.text, order: index + 1 },
      create: { key: question.key, text: question.text, order: index + 1 }
    });

    for (const [value, label, treatmentSlugs] of question.options) {
      const option = await prisma.assessmentOption.upsert({
        where: { questionId_value: { questionId: createdQuestion.id, value } },
        update: { label },
        create: { questionId: createdQuestion.id, value, label }
      });

      for (const treatmentSlug of treatmentSlugs) {
        const treatmentType = await prisma.treatmentType.findUniqueOrThrow({
          where: { slug: treatmentSlug }
        });

        await prisma.assessmentRule.upsert({
          where: {
            optionId_treatmentTypeId: {
              optionId: option.id,
              treatmentTypeId: treatmentType.id
            }
          },
          update: { weight: 1 },
          create: { optionId: option.id, treatmentTypeId: treatmentType.id, weight: 1 }
        });
      }
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@fizioterapi.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin12345!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "Admin", role: Role.ADMIN },
    create: {
      email: adminEmail,
      passwordHash,
      name: "Admin",
      role: Role.ADMIN
    }
  });

  const therapistPasswordHash = await bcrypt.hash("Therapist123!", 12);
  const approvedTherapists = [
    {
      email: "manuel.terapi@fizioterapi.local",
      name: "Uz. Fzt. Ayşe Demir",
      fullName: "Uz. Fzt. Ayşe Demir",
      bio: "Manuel terapi ve ortopedik rehabilitasyon odaklı çalışır.",
      tier: 3,
      specialties: ["manuel-terapi", "ortopedik-rehabilitasyon"],
      packages: [
        { name: "Manuel Terapi Başlangıç", sessionCount: 4, price: 3200, mode: PackageMode.PHYSICAL, treatmentSlug: "manuel-terapi" },
        { name: "Online Ağrı Yönetimi", sessionCount: 3, price: 1800, mode: PackageMode.ONLINE, treatmentSlug: "manuel-terapi" }
      ],
      reviews: [
        { rating: 5, comment: "Ağrım belirgin azaldı.", authorName: "Hasta A" },
        { rating: 4, comment: "Planlı ve açıklayıcı.", authorName: "Hasta B" }
      ]
    },
    {
      email: "sporcu@fizioterapi.local",
      name: "Fzt. Mehmet Kaya",
      fullName: "Fzt. Mehmet Kaya",
      bio: "Spor yaralanmaları ve sahaya dönüş programları.",
      tier: 2,
      specialties: ["sporcu-fizyoterapisi", "ortopedik-rehabilitasyon"],
      packages: [
        { name: "Sporcu Dönüş Paketi", sessionCount: 6, price: 5400, mode: PackageMode.BOTH, treatmentSlug: "sporcu-fizyoterapisi" }
      ],
      reviews: [
        { rating: 5, comment: "Antrenmana güvenli döndüm.", authorName: "Hasta C" }
      ]
    },
    {
      email: "norolojik@fizioterapi.local",
      name: "Fzt. Deniz Şahin",
      fullName: "Fzt. Deniz Şahin",
      bio: "Nörolojik rehabilitasyon ve denge çalışmaları.",
      tier: 1,
      specialties: ["norolojik-rehabilitasyon", "geriatrik"],
      packages: [
        { name: "Nörolojik Rehabilitasyon", sessionCount: 8, price: 6400, mode: PackageMode.PHYSICAL, treatmentSlug: "norolojik-rehabilitasyon" }
      ],
      reviews: [
        { rating: 4, comment: "Denge egzersizleri faydalı oldu.", authorName: "Hasta D" }
      ]
    }
  ] as const;

  for (const therapist of approvedTherapists) {
    const user = await prisma.user.upsert({
      where: { email: therapist.email },
      update: { name: therapist.name, role: Role.THERAPIST },
      create: {
        email: therapist.email,
        passwordHash: therapistPasswordHash,
        name: therapist.name,
        role: Role.THERAPIST
      }
    });

    const profile = await prisma.therapistProfile.upsert({
      where: { userId: user.id },
      update: {
        fullName: therapist.fullName,
        bio: therapist.bio,
        status: TherapistStatus.APPROVED,
        reviewedAt: new Date()
      },
      create: {
        userId: user.id,
        fullName: therapist.fullName,
        bio: therapist.bio,
        status: TherapistStatus.APPROVED,
        reviewedAt: new Date()
      }
    });

    for (const slug of therapist.specialties) {
      const treatmentType = await prisma.treatmentType.findUniqueOrThrow({ where: { slug } });
      await prisma.therapistSpecialty.upsert({
        where: { therapistProfileId_treatmentTypeId: { therapistProfileId: profile.id, treatmentTypeId: treatmentType.id } },
        update: {},
        create: { therapistProfileId: profile.id, treatmentTypeId: treatmentType.id }
      });
    }

    for (const item of therapist.packages) {
      const treatmentType = await prisma.treatmentType.findUniqueOrThrow({ where: { slug: item.treatmentSlug } });
      const existingPackage = await prisma.therapistPackage.findFirst({
        where: { therapistProfileId: profile.id, name: item.name }
      });
      if (existingPackage) {
        await prisma.therapistPackage.update({
          where: { id: existingPackage.id },
          data: { sessionCount: item.sessionCount, price: item.price, mode: item.mode, treatmentTypeId: treatmentType.id }
        });
      } else {
        await prisma.therapistPackage.create({
          data: { therapistProfileId: profile.id, treatmentTypeId: treatmentType.id, name: item.name, sessionCount: item.sessionCount, price: item.price, mode: item.mode }
        });
      }
    }

    for (const review of therapist.reviews) {
      const exists = await prisma.therapistReview.findFirst({
        where: { therapistProfileId: profile.id, authorName: review.authorName }
      });
      if (!exists) {
        await prisma.therapistReview.create({ data: { therapistProfileId: profile.id, ...review } });
      }
    }
  }

}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
