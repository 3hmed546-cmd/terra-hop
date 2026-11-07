export type Locale = "ar" | "en";

export interface Translations {
  common: {
    brand: string;
    currency: string;
    freeShipping: string;
    loading: string;
    backToHome: string;
    langToggle: string;
    targetLang: string;
  };
  header: {
    shop: string;
    about: string;
    help: string;
    cart: string;
    menu: string;
    close: string;
  };
  hero: {
    label: string;
    status: string;
    cta: string;
    hoodieOf: string;
    pause: string;
    play: string;
    taglinePrefix: string;
    taglineAccent: string;
    taglineSub: string;
    explore: string;
    hoodies: Record<string, string>;
  };
  ticker: string[];
  drop: {
    heading: string;
    viewAll: string;
    categories: {
      all: string;
      tshirts: string;
      hoodies: string;
      pants: string;
    };
    preorderBadge: string;
    empty: string;
  };
  products: Record<
    string,
    {
      name: string;
      description: string;
      category: string;
    }
  >;
  brandStory: {
    heading: string;
    body: string;
  };
  quality: {
    heading: string;
    specs: { label: string; value: string }[];
    steps: { title: string; text: string }[];
    link: string;
  };
  signup: {
    badge: string;
    heading: string;
    text: string;
    button: string;
    perks: {
      codes: string;
      drops: string;
      deals: string;
    };
    consent: string;
    directChat: string;
  };
  footer: {
    tagline: string;
    contact: string;
    phone: string;
    email: string;
    copyright: string;
    developedBy: string;
    columns: {
      shop: string;
      about: string;
      help: string;
      shipping: string;
      privacy: string;
      terms: string;
    };
  };
  cart: {
    heading: string;
    emptyTitle: string;
    emptyText: string;
    cta: string;
    size: string;
    quantity: string;
    remove: string;
    subtotal: string;
    shipping: string;
    total: string;
    note: string;
    checkout: string;
    clear: string;
  };
  checkout: {
    title: string;
    subtitle: string;
    emptyCartTitle: string;
    emptyCartDesc: string;
    browseCatalog: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    fields: {
      name: string;
      namePlaceholder: string;
      phone: string;
      phonePlaceholder: string;
      phoneHint: string;
      email: string;
      emailPlaceholder: string;
      emailHint: string;
      city: string;
      cityPlaceholder: string;
      address: string;
      addressPlaceholder: string;
      notes: string;
      notesPlaceholder: string;
    };
    payment: {
      codTitle: string;
      codBadge: string;
      codDesc: string;
      emailInvoiceNotice: string;
    };
    summary: {
      title: string;
      itemsCount: (n: number) => string;
      subtotal: string;
      shipping: string;
      shippingFree: string;
      total: string;
      submitBtn: string;
      submitting: string;
      guarantee: string;
    };
    success: {
      title: string;
      badge: string;
      orderNumberPrefix: string;
      message: string;
      emailNotice: (email: string) => string;
      codNotice: string;
      orderDetailsTitle: string;
      customerInfoTitle: string;
      deliveryTo: string;
      phoneContact: string;
      continueShopping: string;
    };
    errors: {
      nameRequired: string;
      phoneRequired: string;
      phoneInvalid: string;
      emailRequired: string;
      emailInvalid: string;
      cityRequired: string;
      addressRequired: string;
    };
  };
  about: {
    heading: string;
    intro: string;
    body: string[];
    valuesHeading: string;
    values: { label: string; value: string }[];
    cta: string;
  };
  help: {
    heading: string;
    text: string;
    faqHeading: string;
    faq: { q: string; a: string }[];
    shippingHeading: string;
    shippingPoints: { title: string; text: string }[];
    contactHeading: string;
    contactText: string;
  };
  shop: {
    heading: string;
    text: string;
  };
  productPage: {
    back: string;
    breadcrumbHome: string;
    breadcrumbShop: string;
    sizeLabel: string;
    sizeSelected: string;
    sizeError: string;
    sizeGuideBtn: string;
    sizeGuideTitle: string;
    sizeGuideDesc: string;
    shareBtn: string;
    shareCopied: string;
    add: string;
    buyNow: string;
    added: string;
    viewCart: string;
    freeShippingNotice: string;
    freeShippingQualified: string;
    saveAmount: (amt: number) => string;
    trustFeatures: {
      shipping: string;
      payment: string;
      inspection: string;
    };
    installmentNotice: string;
    accordions: {
      descriptionTitle: string;
      featuresTitle: string;
      featuresList: string[];
      shippingTitle: string;
      shippingBody: string;
      returnsTitle: string;
      returnsBody: string;
    };
    relatedHeading: string;
    relatedSubtitle: string;
    stickyBuyNow: string;
    detailsHeading: string;
    details: { label: string; value: string }[];
  };
}

export const translations: Record<Locale, Translations> = {
  ar: {
    common: {
      brand: "TERRA HOP",
      currency: "ج.م",
      freeShipping: "شحن مجاني",
      loading: "جاري التحميل...",
      backToHome: "العودة للرئيسية",
      langToggle: "English",
      targetLang: "en",
    },
    header: {
      shop: "المتجر",
      about: "عن البراند",
      help: "المساعدة",
      cart: "السلة",
      menu: "القائمة",
      close: "إغلاق",
    },
    hero: {
      label: "دروب 01",
      status: "الحجز المسبق متاح",
      cta: "احجز الآن",
      hoodieOf: "هودي {n} من {total}",
      pause: "إيقاف",
      play: "تشغيل",
      taglinePrefix: "تميز",
      taglineAccent: "بأسلوبك",
      taglineSub: "مجموعة الهوديز الجديدة من TERRA HOP",
      explore: "استكشف",
      hoodies: {
        "Dusty Blue": "أزرق رمادي",
        "Off-White": "أوف وايت",
        Black: "أسود",
        Charcoal: "رمادي فحمي",
        Chocolate: "شوكولاتة",
        "Forest Green": "أخضر داكن",
        "Washed Black": "أسود مغسول",
        "Deep Teal": "بترولي داكن",
      },
    },
    ticker: [
      "اشتري 2 وخد شحن مجاني",
      "معاينة وقياس قبل الاستلام والدفع",
      "الدفع عند الاستلام",
      "عروض حصرية على كولكشن DROP 01",
      "شحن سريع لجميع أنحاء مصر",
      "كميات حصرية محدودة",
    ],
    drop: {
      heading: "الكولكشن الأول",
      viewAll: "عرض كل القطع",
      categories: {
        all: "الكل",
        tshirts: "تيشيرتات",
        hoodies: "هوديز",
        pants: "بناطيل",
      },
      preorderBadge: "حجز مسبق",
      empty: "الكولكشن القادم سيتوفر قريباً.",
    },
    products: {
      "phantom-obsidian-hoodie": {
        name: "هودي فانتوم أسود بريميوم",
        description: "هودي ستريت وير أسود فاحم مصنوع من قطن مصري 100% ثقيل (450 GSM). غطاء رأس مزدوج، جيب كانغرو مبطن، وتطريز كوكبي فاخر عالي الكثافة على الصدر.",
        category: "هوديز",
      },
      "dusty-cobalt-hoodie": {
        name: "هودي أزرق ترابي ستريت",
        description: "لون أزرق ترابي استثنائي مستوحى من ألوان الشارع العصرية. قصة أوفرسايز دروب شولدر وأكمام مضلعة سميكة لراحة فائقة في كل حركة.",
        category: "هوديز",
      },
      "vintage-mocha-hoodie": {
        name: "هودي بني موكا فينتاج",
        description: "إطلالة شتوية غنية بلون الشوكولاتة العتيقة وتأثير فينتاج دافئ. قطن مغسول ناعم الملمس متين ومقاوم للوبر.",
        category: "هوديز",
      },
      "alpine-forest-hoodie": {
        name: "هودي أخضر غابات ألبين",
        description: "درجة خضراء غنية وفاخرة مع لوجو أبيض متباين. بطانة داخلية فائقة النعومة وتطريز متقن على المعصم والصدر.",
        category: "هوديز",
      },
      "charcoal-acid-hoodie": {
        name: "هودي رمادي فحمي مغسول",
        description: "معالجة غسيل أسيد فريدة تعطي كل قطعة شخصية حصرية مستقلة. قصة دروب عريضة وجيوب معززة بدرزات ثلاثية.",
        category: "هوديز",
      },
      "deep-ocean-teal-hoodie": {
        name: "هودي أزرق بترولي تيل",
        description: "لون بترولي داكن عميق يجمع بين الغموض والأناقة المعاصرة. تصميم مينيمالي نقي مع تفاصيل متقنة وتشطيب فاخر.",
        category: "هوديز",
      },
      "midnight-slate-navy-hoodie": {
        name: "هودي كحلي أردوازي فاخر",
        description: "تون كحلي أردوازي ملكي ثقيل بتشطيب قطن فاخر. أربطة هودي عريضة بحليات معدنية غير لامعة وغطاء رأس مبطن.",
        category: "هوديز",
      },
      "desert-sand-dunes-hoodie": {
        name: "هودي بيج صحراوي رملي",
        description: "تون بيج رملي دافئ ومريح مناسب للإطلالات اليومية الهادئة. نسيج قطني ناعم جداً على البشرة ومقاوم للتجعد.",
        category: "هوديز",
      },
    },
    brandStory: {
      heading: "خليك على طبيعتك.. والبس بطريقتك.",
      body: "في TERRA HOP بنقدملك قطع مختارة بعناية، بتجمع بين الراحة والتصميم العصري. من أول تفصيلة لآخر خروجة، خليك دائمًا مميز بأسلوبك.",
    },
    quality: {
      heading: "تفاصيل الجودة",
      specs: [
        { label: "القصّة", value: "أوفرسايز مريح وعصري" },
        { label: "الإصدار", value: "كميات محدودة بحجز مسبق" },
      ],
      steps: [
        { title: "١. اختر قطعتك", text: "أضف القطع المفضلة إلى سلة التسوق وحدد مقاسك المناسب." },
        { title: "٢. تأكيد الطلب فوراً", text: "تصلك رسالة وفاتورة على إيميلك ونتواصل معك لتأكيد تفاصيل الشحن." },
        { title: "٣. المعاينة والاستلام", text: "يصلك الأوردر حتى باب بيتك مع إمكانية المعاينة قبل الدفع عند الاستلام." },
      ],
      link: "تصفح جميع القطع",
    },
    signup: {
      badge: "مجتمع TERRA HOP VIP",
      heading: "انضم لمجتمع TERRA HOP على واتساب",
      text: "مكانك الأول للحصول على أكواد الخصم الحصرية، الإشعارات الفورية قبل نزول أي كولكشن جديد، وعروض خاصة بأعضاء الجروب فقط.",
      button: "انضم للجروب الآن",
      perks: {
        codes: "أكواد خصم حصرية للأعضاء",
        drops: "أولوية الحجز في دروب 01",
        deals: "عروض وهدايا حصرية",
      },
      consent: "انضمامك يضمن وصول العروض وأكواد الخصم الحصرية لك فور إطلاقها، بدون أي إزعاج.",
      directChat: "أو تواصل مع خدمة العملاء مباشرة",
    },
    footer: {
      tagline: "Higher on Purpose. ارتقِ بأسلوبك اليومي.",
      contact: "خدمة العملاء",
      phone: "+20 128 569 4670",
      email: "terr3hop@gmail.com",
      copyright: "جميع الحقوق محفوظة لـ TERRA HOP ©",
      developedBy: "DEVELOPED & DESIGNED BY NASAQ",
      columns: {
        shop: "المتجر",
        about: "عن البراند",
        help: "المساعدة والأسئلة",
        shipping: "الشحن والإرجاع",
        privacy: "سياسة الخصوصية",
        terms: "الشروط والأحكام",
      },
    },
    cart: {
      heading: "سلة التسوق",
      emptyTitle: "سلة التسوق فارغة حالياً.",
      emptyText: "اختر قطعك المفضلة من الكولكشن المتاح وستظهر هنا مباشرة.",
      cta: "تصفح الكولكشن الآن",
      size: "المقاس",
      quantity: "الكمية",
      remove: "حذف",
      subtotal: "المجموع الفرعي",
      shipping: "الشحن",
      total: "الإجمالي",
      note: "معاينة القطع متاحة قبل الدفع لمندوب الشحن عند الاستلام.",
      checkout: "الانتقال لإتمام الطلب ←",
      clear: "تفريغ السلة",
    },
    checkout: {
      title: "إتمام الطلب",
      subtitle: "أدخل بيانات التوصيل لإكمال طلبك. الدفع نقداً عند الاستلام بعد المعاينة.",
      emptyCartTitle: "سلة التسوق فارغة",
      emptyCartDesc: "لا توجد منتجات في سلتك لإتمام الشراء. يرجى اختيار بعض القطع أولاً.",
      browseCatalog: "تصفح المنتجات",
      step1Title: "١. بيانات العميل والشحن",
      step1Desc: "يرجى إدخال بيانات دقيقة لضمان وصول مندوب الشحن بدون تأخير.",
      step2Title: "٢. تأكيد طريقة الدفع",
      step2Desc: "جميع الطلبات تُدفع نقداً عند الاستلام بعد المعاينة.",
      fields: {
        name: "الاسم بالكامل",
        namePlaceholder: "مثال: أحمد محمد",
        phone: "رقم الهاتف / الواتساب للتواصل",
        phonePlaceholder: "مثال: 01012345678",
        phoneHint: "سيتواصل معك مندوب الشحن وخدمة العملاء على هذا الرقم.",
        email: "البريد الإلكتروني",
        emailPlaceholder: "name@example.com",
        emailHint: "سنرسل لك فاتورة الطلب ورقم التتبع إلى هذا الإيميل مباشرة.",
        city: "المحافظة",
        cityPlaceholder: "اختر أو اكتب المحافظة (مثال: القاهرة، الجيزة، الإسكندرية...)",
        address: "العنوان بالتفصيل",
        addressPlaceholder: "اسم الشارع، رقم العمارة، رقم الشقة أو علامة مميزة",
        notes: "ملاحظات إضافية للتوصيل (اختياري)",
        notesPlaceholder: "مثال: يرجى الاتصال قبل الوصول بنصف ساعة، التوصيل بعد الساعة 4",
      },
      payment: {
        codTitle: "الدفع عند الاستلام (Cash on Delivery)",
        codBadge: "معاينة مجانية قبل الدفع",
        codDesc: "لن تدفع أي مبالغ إلكترونية الآن. يتم الدفع نقداً لمندوب الشحن بعد استلام الأوردر ومعاينته والتأكد من الجودة والمقاس.",
        emailInvoiceNotice: "ستصلك رسالة إلكترونية فورية تحتوي على تفاصيل طلبك والفاتورة وتاريخ الشحن المتوقع.",
      },
      summary: {
        title: "ملخص الطلب",
        itemsCount: (n: number) => `${n} قطع في الطلب`,
        subtotal: "المجموع الفرعي",
        shipping: "رسوم الشحن",
        shippingFree: "مجاني",
        total: "المبلغ الإجمالي للدفع",
        submitBtn: "تأكيد الطلب الآن",
        submitting: "جاري تسجيل وتأكيد الطلب...",
        guarantee: "✓ ضمان المعاينة وقياس القطع قبل الاستلام والدفع.",
      },
      success: {
        title: "تم تسجيل وتأكيد طلبك بنجاح!",
        badge: "طلب قيد المراجعة والشحن",
        orderNumberPrefix: "رقم الطلب الخاص بك:",
        message: "شكراً لطلبك من TERRA HOP! سنبدأ في تجهيز قطعك فوراً.",
        emailNotice: (email: string) => `تم إرسال رسالة تأكيد إلكترونية تحتوي على تفاصيل الفاتورة الكاملة إلى: ${email}`,
        codNotice: "طريقة الدفع: الدفع نقداً عند الاستلام والمعاينة لمندوب الشحن.",
        orderDetailsTitle: "تفاصيل المنتجات المطلوبة",
        customerInfoTitle: "بيانات التوصيل المسجلة",
        deliveryTo: "العنوان:",
        phoneContact: "رقم الهاتف المسجل:",
        continueShopping: "العودة إلى المتجر ومتابعة التسوق",
      },
      errors: {
        nameRequired: "يرجى إدخال الاسم بالكامل.",
        phoneRequired: "يرجى إدخال رقم الهاتف للتواصل.",
        phoneInvalid: "يرجى إدخال رقم هاتف صحيح (11 رقماً).",
        emailRequired: "يرجى إدخال بريدك الإلكتروني لاستلام الفاتورة.",
        emailInvalid: "يرجى إدخال بريد إلكتروني صحيح.",
        cityRequired: "يرجى تحديد المحافظة.",
        addressRequired: "يرجى كتابة عنوان التوصيل بالتفصيل.",
      },
    },
    about: {
      heading: "عن TERRA HOP",
      intro: "ملابس ستريت وير أوفرسايز للشباب في مصر.",
      body: [
        "تيرا هوب تقدم إصدارات حصرية بكميات محدودة. كل قطعة تُؤكد بالطلب المسبق قبل بدء الإنتاج لضمان الجودة والتميز.",
        "نحافظ على تشكيلة محددة وقصة أوفرسايز مدروسة. هدفنا بسيط: قطع ترتديها وتعتمد عليها كل يوم.",
      ],
      valuesHeading: "كيف نعمل",
      values: [
        { label: "القصّة", value: "أوفرسايز مريح وعصري" },
        { label: "الإصدار", value: "كميات محدودة بحجز مسبق" },
        { label: "صُنع لـ", value: "الشباب في مصر" },
      ],
      cta: "تصفح جميع القطع",
    },
    help: {
      heading: "المساعدة والأسئلة الشائعة",
      text: "إجابات سريعة حول الطلب، الحجز المسبق والتوصيل. لم تجد إجابتك؟ تواصل معنا عبر الواتساب.",
      faqHeading: "الأسئلة الشائعة",
      faq: [
        {
          q: "كيف أقوم بالطلب؟",
          a: "أضف القطع المفضلة إلى سلتك وأكمل بيانات الشحن في صفحة إتمام الطلب. سنرسل لك تفاصيل الفاتورة فوراً ونتواصل معك لتأكيد التوصيل.",
        },
        {
          q: "ماذا يعني الحجز المسبق (Preorder)؟",
          a: "القطع يتم تأكيدها وإنتاجها بكميات محددة بناءً على الحجز المسبق، لتصلك طازجة بأعلى جودة وتقفيل احترافي.",
        },
        {
          q: "كيف يتم الدفع؟",
          a: "الدفع نقداً عند الاستلام (Cash on Delivery) بعد استلام الشحنة ومعاينتها بالكامل مع مندوب الشحن.",
        },
        {
          q: "ما هو المقاس الأنسب لي؟",
          a: "قطعنا مصممة بقصة أوفرسايز واسعة. اختر مقاسك المعتاد للحصول على إطلالة أوفرسايز مريحة، أو مقاساً أصغر لمقاس أقرب للجسم.",
        },
      ],
      shippingHeading: "الشحن والمعاينة",
      shippingPoints: [
        {
          title: "التوصيل",
          text: "يتم توصيل الطلبات لجميع محافظات مصر بعد التأكيد، مع إشعارك بموعد وصول المندوب.",
        },
        {
          title: "المعاينة قبل الدفع",
          text: "يحق لك فحص ومعاينة القطع والتأكد من المقاس والخامة قبل دفع المبلغ لمندوب الشحن.",
        },
      ],
      contactHeading: "تواصل معنا",
      contactText: "فريق خدمة عملاء TERRA HOP متواجد دائماً للرد على استفساراتكم عبر الواتساب والبريد الإلكتروني.",
    },
    shop: {
      heading: "المتجر",
      text: "جميع قطع الكولكشن الأول DROP 01. كميات حصرية ومحدودة بحجز مسبق.",
    },
    productPage: {
      back: "العودة إلى المتجر",
      breadcrumbHome: "الرئيسية",
      breadcrumbShop: "المتجر",
      sizeLabel: "اختر المقاس",
      sizeSelected: "المقاس المحدد:",
      sizeError: "يُرجى اختيار المقاس أولاً لإتمام طلبك",
      sizeGuideBtn: "دليل المقاسات",
      sizeGuideTitle: "جدول دليل المقاسات (بالسنتيمتر)",
      sizeGuideDesc: "جميع مقاساتنا أوفرسايز واسعة ومريحة. اختر مقاسك المعتاد للحصول على الستايل الفضفاض المميز.",
      shareBtn: "مشاركة",
      shareCopied: "تم نسخ رابط المنتج بنجاح!",
      add: "أضف إلى العربة",
      buyNow: "شراء الآن",
      added: "تمت الإضافة بنجاح!",
      viewCart: "عرض السلة وإتمام الطلب",
      freeShippingNotice: "شحن مجاني لجميع المحافظات للطلبات أعلى من 599 جنيه",
      freeShippingQualified: "أنت مؤهل للشحن المجاني لهذا الطلب!",
      saveAmount: (amt: number) => `وفرت ${amt} جنيه`,
      trustFeatures: {
        shipping: "شحن مجاني وسريع للطلبات المؤهلة لجميع محافظات مصر",
        payment: "الدفع عند الاستلام وجميع وسائل الدفع متاحة",
        inspection: "معاينة وقياس مجاني مع المندوب قبل الدفع",
      },
      installmentNotice: "قسمها على 3 أو 4 دفعات بدون فوائد مع فاليو أو تابي / كاش أون ديلفري",
      accordions: {
        descriptionTitle: "وصف المنتج",
        featuresTitle: "ملخص للمميزات",
        featuresList: [
          "خامة قطن مصري فاخر 100% ثقيل ومريح (240+ GSM)",
          "قصة أوفرسايز عصرية (Dropped Shoulders) مريحة وأنيقة",
          "ياقة مضلعة محكمة لا تتمدد مع الارتداء والغسيل اليومي",
          "طباعة وتطريز عالي الجودة مقاوم للبهتان والتشقق",
          "معالجة خاصة للأقمشة ضد الانكماش والوبر",
        ],
        shippingTitle: "الشحن والمعاينة",
        shippingBody: "شحن قياسي سريع خلال 2 إلى 4 أيام عمل لكافة محافظات الجمهورية. نوفر لك ميزة فتح الشحنة ومعاينة الخامة وقياس المقاس بنفسك قبل سداد أي مبلغ لمندوب التوصيل، وفي حال عدم الرغبة يمكنك رفض الاستلام مجاناً.",
        returnsTitle: "سياسة الاستبدال والإرجاع",
        returnsBody: "لك كامل الحق في فحص وتجربة الشحنة عند الاستلام مع المندوب. كما نوفر خدمة استبدال المقاس خلال 14 يوماً من تاريخ الاستلام بكل سهولة وبدون أي تعقيد عبر التواصل مع خدمة العملاء.",
      },
      relatedHeading: "تحب تشوف حاجة تانية ؟",
      relatedSubtitle: "استكشف باقي تشكيلة منتجات TERRA HOP الحصرية",
      stickyBuyNow: "شراء الآن",
      detailsHeading: "تفاصيل القطعة",
      details: [
        { label: "القصّة", value: "أوفرسايز مريح وعصري" },
        { label: "الخامة", value: "قطن مصري عالي الجودة 100%" },
        { label: "الإصدار", value: "كميات محدودة تأكيد مسبق" },
        { label: "المعاينة", value: "معاينة مجانية قبل الدفع والاستلام" },
      ],
    },
  },
  en: {
    common: {
      brand: "TERRA HOP",
      currency: "EGP",
      freeShipping: "Free Shipping",
      loading: "Loading...",
      backToHome: "Back to Home",
      langToggle: "العربية",
      targetLang: "ar",
    },
    header: {
      shop: "Shop",
      about: "About",
      help: "Help",
      cart: "Cart",
      menu: "Menu",
      close: "Close",
    },
    hero: {
      label: "Drop 01",
      status: "Preorder open",
      cta: "Preorder",
      hoodieOf: "Hoodie {n} of {total}",
      pause: "PAUSE",
      play: "PLAY",
      taglinePrefix: "STAND OUT IN",
      taglineAccent: "YOUR STYLE",
      taglineSub: "The New Hoodie Collection by TERRA HOP",
      explore: "EXPLORE",
      hoodies: {
        "Dusty Blue": "Dusty Blue",
        "Off-White": "Off-White",
        Black: "Black",
        Charcoal: "Charcoal",
        Chocolate: "Chocolate",
        "Forest Green": "Forest Green",
        "Washed Black": "Washed Black",
        "Deep Teal": "Deep Teal",
      },
    },
    ticker: [
      "BUY 2 GET FREE SHIPPING",
      "INSPECTION & TRY-ON BEFORE PAYMENT",
      "CASH ON DELIVERY",
      "EXCLUSIVE PREORDER OFFERS ON DROP 01",
      "FAST SHIPPING ACROSS ALL OF EGYPT",
      "LIMITED QUANTITIES AVAILABLE",
    ],
    drop: {
      heading: "The Drop",
      viewAll: "View all",
      categories: {
        all: "All",
        tshirts: "T-shirts",
        hoodies: "Hoodies",
        pants: "Pants",
      },
      preorderBadge: "PREORDER",
      empty: "The next drop is coming soon.",
    },
    products: {
      "phantom-obsidian-hoodie": {
        name: "Phantom Obsidian Hoodie",
        description: "Heavyweight 100% combed cotton fleece (450 GSM), dropped shoulders, double-layer hood, and high-density planet chest embroidery.",
        category: "Hoodies",
      },
      "dusty-cobalt-hoodie": {
        name: "Dusty Cobalt Streetwear Hoodie",
        description: "Rare dusty blue hue tailored in an oversized streetwear fit with heavy ribbed trims for all-day effortless comfort.",
        category: "Hoodies",
      },
      "vintage-mocha-hoodie": {
        name: "Vintage Mocha Brown Hoodie",
        description: "Warm seasonal chocolate tones with a soft vintage pre-shrunk cotton touch, built to resist pilling and retain form.",
        category: "Hoodies",
      },
      "alpine-forest-hoodie": {
        name: "Alpine Forest Green Hoodie",
        description: "Deep luxury forest green hoodie with contrast branding, ultra-soft brushed fleece lining, and reinforced stitching.",
        category: "Hoodies",
      },
      "charcoal-acid-hoodie": {
        name: "Charcoal Acid-Wash Hoodie",
        description: "Distinct acid-washed vintage mineral finish granting every piece its own unique streetwear edge and character.",
        category: "Hoodies",
      },
      "deep-ocean-teal-hoodie": {
        name: "Deep Ocean Teal Hoodie",
        description: "Rich dark oceanic teal shade crafted for an understated contemporary aesthetic with obsessive tailoring details.",
        category: "Hoodies",
      },
      "midnight-slate-navy-hoodie": {
        name: "Midnight Slate Navy Hoodie",
        description: "Regal slate navy heavyweight cotton fleece with custom matte hardware and cozy double-layered hood.",
        category: "Hoodies",
      },
      "desert-sand-dunes-hoodie": {
        name: "Desert Sand Dunes Hoodie",
        description: "Warm desert sand beige tone in a relaxed silhouette, offering lightweight breathability and gentle fleece comfort.",
        category: "Hoodies",
      },
    },
    brandStory: {
      heading: "Be yourself.. and wear it your way.",
      body: "At TERRA HOP, we bring you carefully selected pieces that combine comfort and modern streetwear. From the first detail to every hangout, always stand out in your own style.",
    },
    quality: {
      heading: "Details",
      specs: [
        { label: "Fit", value: "Oversized" },
        { label: "Release", value: "Small drops, confirmed by preorder" },
      ],
      steps: [
        { title: "1. Place your order", text: "Add pieces to your cart and enter your delivery details." },
        { title: "2. Order confirmation", text: "We email your invoice details immediately and call to confirm shipping." },
        { title: "3. Delivery & Inspection", text: "Your order is delivered with full right to inspect and try on before paying COD." },
      ],
      link: "Shop all pieces",
    },
    signup: {
      badge: "TERRA HOP VIP COMMUNITY",
      heading: "Join the TERRA HOP WhatsApp Community",
      text: "Your exclusive circle for VIP discount codes, early drop notifications before public release, and private community specials.",
      button: "Join WhatsApp Group Now",
      perks: {
        codes: "Exclusive VIP discount codes",
        drops: "Priority access to Drop 01",
        deals: "Private community gifts & perks",
      },
      consent: "Instant access to member-only drops and private promo codes. Zero spam.",
      directChat: "Or chat with customer support directly",
    },
    footer: {
      tagline: "Higher on Purpose.",
      contact: "Contact",
      phone: "+20 128 569 4670",
      email: "terr3hop@gmail.com",
      copyright: "© TERRA HOP",
      developedBy: "DEVELOPED & DESIGNED BY NASAQ",
      columns: {
        shop: "Shop",
        about: "About",
        help: "Help",
        shipping: "Shipping and Returns",
        privacy: "Privacy",
        terms: "Terms",
      },
    },
    cart: {
      heading: "Cart",
      emptyTitle: "Your cart is empty.",
      emptyText: "Pick a piece from the current drop and it will show up here.",
      cta: "Shop all pieces",
      size: "Size",
      quantity: "Quantity",
      remove: "Remove",
      subtotal: "Subtotal",
      shipping: "Shipping",
      total: "Total",
      note: "Cash on delivery with full inspection before payment.",
      checkout: "Proceed to Checkout →",
      clear: "Clear cart",
    },
    checkout: {
      title: "Checkout",
      subtitle: "Enter your delivery details to complete your order. Cash on delivery.",
      emptyCartTitle: "Your Cart is Empty",
      emptyCartDesc: "There are no items in your cart to checkout. Pick pieces from our collection first.",
      browseCatalog: "Browse Products",
      step1Title: "1. Customer & Shipping Details",
      step1Desc: "Please provide accurate information for smooth and prompt delivery.",
      step2Title: "2. Payment Method",
      step2Desc: "All orders are fulfilled with Cash on Delivery upon inspection.",
      fields: {
        name: "Full Name",
        namePlaceholder: "e.g. Karim Ahmed",
        phone: "Phone / WhatsApp Number",
        phonePlaceholder: "e.g. 01012345678",
        phoneHint: "Our courier and support team will contact you on this number.",
        email: "Email Address",
        emailPlaceholder: "name@example.com",
        emailHint: "Your order receipt, invoice, and tracking details will be sent here.",
        city: "Governorate / City",
        cityPlaceholder: "Select or type your city (e.g. Cairo, Giza, Alexandria...)",
        address: "Detailed Street Address",
        addressPlaceholder: "Street name, building number, apartment, floor, landmark",
        notes: "Delivery Notes (optional)",
        notesPlaceholder: "e.g. Call 30 mins before arrival, deliver after 4 PM",
      },
      payment: {
        codTitle: "Cash on Delivery (COD)",
        codBadge: "Inspection upon delivery",
        codDesc: "No upfront electronic payment needed. Pay in cash to the courier after opening the package and inspecting the items.",
        emailInvoiceNotice: "You will immediately receive an email with your full invoice breakdown and order reference.",
      },
      summary: {
        title: "Order Summary",
        itemsCount: (n: number) => `${n} items in order`,
        subtotal: "Subtotal",
        shipping: "Shipping Fee",
        shippingFree: "Free",
        total: "Total Amount Due",
        submitBtn: "Confirm Order Now",
        submitting: "Placing Order...",
        guarantee: "✓ 100% Free inspection before receiving and paying.",
      },
      success: {
        title: "Order Placed Successfully!",
        badge: "Processing & Dispatch",
        orderNumberPrefix: "Your Order Reference:",
        message: "Thank you for ordering from TERRA HOP! We are preparing your order.",
        emailNotice: (email: string) => `A confirmation email with your invoice has been sent to: ${email}`,
        codNotice: "Payment: Cash on delivery upon package inspection.",
        orderDetailsTitle: "Ordered Items",
        customerInfoTitle: "Delivery Destination",
        deliveryTo: "Address:",
        phoneContact: "Contact Phone:",
        continueShopping: "Continue Shopping",
      },
      errors: {
        nameRequired: "Please enter your full name.",
        phoneRequired: "Please enter your phone number.",
        phoneInvalid: "Please enter a valid phone number (11 digits).",
        emailRequired: "Please enter your email to receive order updates.",
        emailInvalid: "Please enter a valid email address.",
        cityRequired: "Please select or enter your city / governorate.",
        addressRequired: "Please provide your detailed delivery address.",
      },
    },
    about: {
      heading: "About TERRA HOP",
      intro: "Oversized streetwear for young men in Egypt.",
      body: [
        "TERRA HOP releases small drops. Every piece is confirmed by preorder before production, so nothing is made that nobody asked for.",
        "We keep the range short and the fit oversized. The goal is simple: pieces you reach for every day.",
      ],
      valuesHeading: "How we work",
      values: [
        { label: "Fit", value: "Oversized" },
        { label: "Release", value: "Small drops, confirmed by preorder" },
        { label: "Made for", value: "Young men in Egypt" },
      ],
      cta: "Shop all pieces",
    },
    help: {
      heading: "Help & FAQ",
      text: "Quick answers about ordering, preorders and delivery. Can't find yours? Message us.",
      faqHeading: "Questions",
      faq: [
        {
          q: "How do I order?",
          a: "Add pieces to your cart and complete your delivery details at checkout. We email your invoice immediately and call to confirm shipping.",
        },
        {
          q: "What does preorder mean?",
          a: "A preorder piece is produced in limited runs after confirmation, ensuring peak quality and craftsmanship.",
        },
        {
          q: "How do I pay?",
          a: "Cash on delivery (COD) after you receive, inspect, and approve your items.",
        },
        {
          q: "Which size should I pick?",
          a: "Our pieces are cut oversized. Take your usual size for a relaxed oversized fit, or go one size down for a standard fit.",
        },
      ],
      shippingHeading: "Shipping & Inspection",
      shippingPoints: [
        {
          title: "Delivery",
          text: "Orders are delivered across Egypt after confirmation. You receive tracking and timing updates.",
        },
        {
          title: "Inspection",
          text: "You have the full right to open, inspect and check the fit before paying cash to the courier.",
        },
      ],
      contactHeading: "Contact us",
      contactText: "Reach out to our customer care team on WhatsApp or by email anytime.",
    },
    shop: {
      heading: "Shop",
      text: "Every piece in the current drop. Small runs, confirmed by preorder.",
    },
    productPage: {
      back: "Back to shop",
      breadcrumbHome: "Home",
      breadcrumbShop: "Shop",
      sizeLabel: "Select Size",
      sizeSelected: "Selected Size:",
      sizeError: "Please select a size first to proceed",
      sizeGuideBtn: "Size Guide",
      sizeGuideTitle: "Size Guide Chart (cm)",
      sizeGuideDesc: "All our pieces feature an oversized relaxed fit. Choose your standard size for the intended loose aesthetic.",
      shareBtn: "Share",
      shareCopied: "Product link copied to clipboard!",
      add: "Add to Cart",
      buyNow: "Buy Now",
      added: "Added successfully!",
      viewCart: "View Cart & Checkout",
      freeShippingNotice: "Free shipping across Egypt on orders above 599 EGP",
      freeShippingQualified: "You unlocked free shipping for this piece!",
      saveAmount: (amt: number) => `Save EGP ${amt}`,
      trustFeatures: {
        shipping: "Fast & Free shipping across all Egypt governorates",
        payment: "Cash on delivery & all payment methods available",
        inspection: "100% Free inspection & try-on before paying",
      },
      installmentNotice: "Split into 3 or 4 interest-free installments or pay Cash on Delivery",
      accordions: {
        descriptionTitle: "Product Description",
        featuresTitle: "Key Highlights",
        featuresList: [
          "Premium 100% heavy Egyptian cotton (240+ GSM)",
          "Modern dropped shoulder boxy oversized silhouette",
          "Durable ribbed collar that maintains shape over time",
          "High-definition fade-resistant embroidery & screen-print",
          "Pre-shrunk fabric to prevent post-wash distortion",
        ],
        shippingTitle: "Shipping & Inspection",
        shippingBody: "Fast delivery within 2 to 4 business days to any address across Egypt. You can open, inspect, and try on your item before paying the courier.",
        returnsTitle: "Exchange & Return Policy",
        returnsBody: "Full inspection rights at delivery. If not satisfied, reject on the spot at 0 shipping fee. Size exchanges are also honored within 14 days of receipt.",
      },
      relatedHeading: "You May Also Like",
      relatedSubtitle: "Explore more exclusive pieces from TERRA HOP",
      stickyBuyNow: "Buy Now",
      detailsHeading: "Details",
      details: [
        { label: "Fit", value: "Oversized" },
        { label: "Material", value: "Premium Egyptian cotton 100%" },
        { label: "Release", value: "Small drops, confirmed by preorder" },
        { label: "Inspection", value: "100% Free inspection before receiving and paying" },
      ],
    },
  },
};
