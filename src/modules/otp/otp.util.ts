export const partnerAccountCreation = (language?: string) => {
  const countryLanguage = language ?? 'english';
  switch (countryLanguage) {
    case 'english':
      return {
        content: `Thank you for trusting us! Welcome to our services. To finish setting up your account securely, please confirm by entering your email through this link. Completing this process using this link will ensure your account is secure.`,
      };
    case 'arabic':
      return {
        content: `شكرًا لثقتك فينا! مرحبًا بك في خدماتنا. لإنهاء إعداد حسابك بأمان، يرجى التأكيد بإدخال بريدك الإلكتروني من خلال هذا الرابط. إكمال هذه العملية باستخدام هذا الرابط سيضمن أمان حسابك.`,
      };
    case 'spanish':
      return {
        content: `¡Gracias por confiar en nosotros! Bienvenido a nuestros servicios. Para terminar de configurar tu cuenta de manera segura, por favor confirma ingresando tu correo electrónico a través de este enlace. Completar este proceso mediante este enlace asegurará que tu cuenta esté segura.`,
      };
    case 'french':
      return {
        content: `Merci de nous faire confiance ! Bienvenue dans nos services. Pour terminer la configuration de votre compte en toute sécurité, veuillez confirmer en saisissant votre email via ce lien. Compléter ce processus via ce lien garantira la sécurité de votre compte.`,
      };

    case 'german':
      return {
        content: `Danke, dass Sie uns vertrauen! Willkommen bei unseren Dienstleistungen. Um Ihr Konto sicher einzurichten, bestätigen Sie bitte durch Eingabe Ihrer E-Mail über diesen Link. Durch Abschluss dieses Prozesses über diesen Link wird Ihr Konto gesichert.`,
      };
    case 'russian':
      return {
        content: `Спасибо за ваше доверие! Добро пожаловать в наши услуги. Чтобы завершить настройку вашего аккаунта безопасно, пожалуйста, подтвердите, введя свой электронный адрес через эту ссылку. Завершение этого процесса с помощью данной ссылки обеспечит безопасность вашего аккаунта.`,
      };
    case 'portuguese':
      return {
        content: `Obrigado por confiar em nós! Bem-vindo aos nossos serviços. Para terminar de configurar sua conta de forma segura, por favor confirme inserindo seu email através deste link. Completar este processo usando este link garantirá que sua conta esteja segura.`,
      };
    case 'italian':
      return {
        content: `Grazie per averci dato fiducia! Benvenuto nei nostri servizi. Per completare l'impostazione del tuo account in modo sicuro, conferma inserendo la tua email tramite questo link. Completare questo processo tramite questo link garantirà la sicurezza del tuo account.`,
      };
    case 'hebrew':
      return {
        content: `תודה שסמכת עלינו! ברוך הבא לשירותינו. לסיום הגדרת החשבון שלך באופן מאובטח, אנא אשר על ידי הזנת הדואל שלך באמצעות הקישור הזה. השלמת התהליך זה באמצעות הקישור יבטיח את בטחון החשבון שלך.`,
      };
    case 'dutch':
      return {
        content: `Bedankt dat u ons vertrouwt! Welkom bij onze diensten. Om uw account veilig in te stellen, bevestig dit alstublieft door uw e-mail in te voeren via deze link. Het voltooien van dit proces via deze link zal zorgen dat uw account veilig is.`,
      };
    case 'bulgarian':
      return {
        content: `Благодарим ви, че ни се доверихте! Добре дошли в нашите услуги. За да завършите настройката на вашия акаунт по сигурен начин, моля потвърдете като въведете вашия имейл чрез този линк. Завършването на този процес чрез този линк ще гарантира сигурността на вашия акаунт.`,
      };
    case 'greek':
      return {
        content: `Σας ευχαριστούμε που μας εμπιστεύεστε! Καλώς ήρθατε στις υπηρεσίες μας. Για να ολοκληρώσετε τη ρύθμιση του λογαριασμού σας με ασφάλεια, επιβεβαιώστε εισάγοντας το email σας μέσω αυτού του συνδέσμου. Η ολοκλήρωση αυτής της διαδικασίας μέσω αυτού του συνδέσμου θα εξασφαλίσει την ασφάλεια του λογαριασμού σας.`,
      };
    case 'swedish':
      return {
        content: `Tack för att du litar på oss! Välkommen till våra tjänster. För att slutföra inställningen av ditt konto säkert, vänligen bekräfta genom att ange din e-post via denna länk. Att slutföra denna process via denna länk kommer att säkerställa att ditt konto är säkert.`,
      };
    default:
      return {
        content: `Thank you for trusting us! Welcome to our services. To finish setting up your account securely, please confirm by entering your email through this link. Completing this process using this link will ensure your account is secure.`,
      };
  }
};

export const reminder = (language?: string, reminderNumber?: number, verificationLink?: string) => {
  const countryLanguage = language ?? 'english';
  switch (countryLanguage) {
    case 'english':
      return {
        content: `Hi, a friendly reminder: Your account verification is still pending. This is Reminder ${reminderNumber} of 3. To ensure uninterrupted service, kindly verify your email by clicking here: ${verificationLink}${
          reminderNumber === 3
            ? `\nNote: This is the final reminder. In case of non-verification within the next 2 weeks, your account will be suspended.`
            : ''
        }`,
      };
    case 'spanish':
      return {
        content: `Hola, un recordatorio amistoso: La verificación de tu cuenta aún está pendiente. Este es el Recordatorio ${reminderNumber} de 3. Para asegurar un servicio ininterrumpido, por favor verifica tu correo electrónico haciendo clic aquí: ${verificationLink}${
          reminderNumber === 3
            ? `\nNota: Este es el último recordatorio. En caso de no verificación en las próximas 2 semanas, tu cuenta será suspendida.`
            : ''
        }`,
      };
    case 'arabic':
      return {
        content: `مرحباً، تذكير ودي: لا يزال التحقق من حسابك معلقًا. هذا هو التذكير ${reminderNumber} من 3. لضمان استمرارية الخدمة، يرجى التحقق من بريدك الإلكتروني بالنقر هنا: ${verificationLink}${
          reminderNumber === 3
            ? `\nملاحظة: هذا هو التذكير الأخير. في حال عدم التحقق خلال الأسبوعين المقبلين، سيتم تعليق حسابك.`
            : ''
        }`,
      };
    case 'french':
      return {
        content: `Bonjour, un rappel amical : La vérification de votre compte est toujours en attente. Ceci est le rappel ${reminderNumber} sur 3. Pour garantir un service ininterrompu, veuillez vérifier votre email en cliquant ici : ${verificationLink}${
          reminderNumber === 3
            ? `\nNote : Ceci est le dernier rappel. En cas de non-vérification dans les 2 prochaines semaines, votre compte sera suspendu.`
            : ''
        }`,
      };
    case 'german':
      return {
        content: `Hallo, eine freundliche Erinnerung : Ihre Kontoverifizierung steht noch aus. Dies ist die Erinnerung ${reminderNumber} von 3. Um einen unterbrechungsfreien Service zu gewährleisten, überprüfen Sie bitte Ihre E-Mail, indem Sie hier klicken: ${verificationLink}${
          reminderNumber === 3
            ? `\nHinweis: Dies ist die letzte Erinnerung. Bei Nichtverifizierung innerhalb der nächsten 2 Wochen wird Ihr Konto gesperrt.`
            : ''
        }`,
      };
    case 'russian':
      return {
        content: `Привет, дружеское напоминание: Верификация вашего аккаунта все еще не завершена. Это напоминание ${reminderNumber} из 3. Чтобы обеспечить непрерывность сервиса, пожалуйста, подтвердите вашу электронную почту, нажав здесь: ${verificationLink}${
          reminderNumber === 3
            ? `\nПримечание: Это последнее напоминание. В случае отсутствия верификации в течение следующих 2 недель ваш аккаунт будет приостановлен.`
            : ''
        }`,
      };
    case 'portuguese':
      return {
        content: `Olá, um lembrete amigável: A verificação da sua conta ainda está pendente. Este é o Lembrete ${reminderNumber} de 3. Para garantir um serviço ininterrupto, por favor verifique seu e-mail clicando aqui: ${verificationLink}${
          reminderNumber === 3
            ? `\nNota: Este é o último lembrete. Caso não haja verificação nas próximas 2 semanas, sua conta será suspensa.`
            : ''
        }`,
      };
    case 'italian':
      return {
        content: `Ciao, un promemoria amichevole: La verifica del tuo account è ancora in sospeso. Questo è il Promemoria ${reminderNumber} di 3. Per garantire un servizio ininterrotto, verifica la tua email cliccando qui: ${verificationLink}${
          reminderNumber === 3
            ? `\nNota: Questo è l'ultimo promemoria. In caso di mancata verifica nelle prossime 2 settimane, il tuo account sarà sospeso.`
            : ''
        }`,
      };

    case 'hebrew':
      return {
        content: `היי, תזכורת חברתית: אימות החשבון שלך עדיין ממתין. זו תזכורת ${reminderNumber} מתוך 3. כדי להבטיח שירות ללא הפסקה, אנא אמת את הדואל שלך על ידי לחיצה כאן: ${verificationLink}${reminderNumber === 3 ? '\\nהערה: זוהי התזכורת האחרונה. במידה ולא תבוצע אימות בשבועיים הבאים, החשבון שלך יושעה.' : ''}`,
      };
    case 'dutch':
      return {
        content: `Hoi, een vriendelijke herinnering : De verificatie van uw account is nog steeds hangende. Dit is Herinnering ${reminderNumber} van 3. Om een ononderbroken service te garanderen, gelieve uw e-mail te verifiëren door hier te klikken: ${verificationLink}${
          reminderNumber === 3
            ? `\nOpmerking: Dit is de laatste herinnering. In geval van niet-verificatie binnen de volgende 2 weken zal uw account worden opgeschort.`
            : ''
        }`,
      };
    case 'bulgarian':
      return {
        content: `Здравейте, приятелско напомняне: Потвърждението на акаунта ви все още е предстоящо. Това е напомняне ${reminderNumber} от 3. За да гарантирате непрекъснато обслужване, моля потвърдете имейла си като кликнете тук: ${verificationLink}${
          reminderNumber === 3
            ? `\nЗабележка: Това е последното напомняне. В случай че не потвърдите в следващите 2 седмици, акаунтът ви ще бъде спрян.`
            : ''
        }`,
      };
    case 'greek':
      return {
        content: `Γεια, μια φιλική υπενθύμιση : Η επαλήθευση του λογαριασμού σας είναι ακόμη εκκρεμής. Αυτή είναι η Υπενθύμιση ${reminderNumber} από 3. Για να διασφαλίσετε αδιάλειπτη υπηρεσία, παρακαλούμε επιβεβαιώστε το email σας κάνοντας κλικ εδώ: ${verificationLink}${
          reminderNumber === 3
            ? `\nΣημείωση: Αυτή είναι η τελευταία υπενθύμιση. Σε περίπτωση μη επαλήθευσης εντός των επόμενων 2 εβδομάδων, ο λογαριασμός σας θα ανασταλεί.`
            : ''
        }`,
      };  
    case 'swedish':
      return {
        content: `Hej, en vänlig påminnelse: Din kontoverifiering är fortfarande inte klar. Detta är Påminnelse ${reminderNumber} av 3. För att säkerställa oavbruten service, vänligen verifiera din e-post genom att klicka här: ${verificationLink}${
          reminderNumber === 3
            ? `\nObs: Detta är den sista påminnelsen. Om verifiering inte sker inom de närmaste 2 veckorna kommer ditt konto att suspenderas.`
            : ''
        }`,
      };
    default:
      return {
        content: `Hi, a friendly reminder: Your account verification is still pending. This is Reminder ${reminderNumber} of 3. To ensure uninterrupted service, kindly verify your email by clicking here: ${verificationLink}${
          reminderNumber === 3
            ? `\nNote: This is the final reminder. In case of non-verification within the next 2 weeks, your account will be suspended.`
            : ''
        }`,
      };
  }
};

export const verificationLinkToPhone = (language?: string, reminderNumber?: number, verificationLink?: string) => {
  const countryLanguage = language ?? 'english';
  switch (countryLanguage) {
    case 'english':
      return {
        content: `Hi, a friendly reminder. Your account verification is still pending. This is Reminder ${reminderNumber} of 3. To ensure uninterrupted service, kindly verify your email by clicking here: ${verificationLink}`,
      };
    case 'spanish':
      return {
        content: `Hola, un recordatorio amistoso. La verificación de tu cuenta aún está pendiente. Este es el Recordatorio ${reminderNumber} de 3. Para asegurar un servicio ininterrumpido, por favor verifica tu correo electrónico haciendo clic aquí: ${verificationLink}`,
      };
    case 'arabic':
      return {
        content: `مرحباً، تذكير ودي. لا يزال التحقق من حسابك معلقًا. هذا هو التذكير ${reminderNumber} من 3. لضمان استمرارية الخدمة، يرجى التحقق من بريدك الإلكتروني بالنقر هنا: ${verificationLink}`,
      };
    case 'french':
      return {
        content: `Bonjour, un rappel amical. La vérification de votre compte est toujours en attente. Ceci est le rappel ${reminderNumber} sur 3. Pour garantir un service ininterrompu, veuillez vérifier votre email en cliquant ici : ${verificationLink}`,
      };
    case 'german':
      return {
        content: `Hallo, eine freundliche Erinnerung. Ihre Kontoverifizierung steht noch aus. Dies ist die Erinnerung ${reminderNumber} von 3. Um einen unterbrechungsfreien Service zu gewährleisten, überprüfen Sie bitte Ihre E-Mail, indem Sie hier klicken: ${verificationLink}`,
      };
    case 'russian':
      return {
        content: `Привет, дружеское напоминание. Верификация вашего аккаунта все еще не завершена. Это напоминание ${reminderNumber} из 3. Чтобы обеспечить непрерывность сервиса, пожалуйста, подтвердите вашу электронную почту, нажав здесь: ${verificationLink}`,
      };
    case 'portuguese':
      return {
        content: `Olá, um lembrete amigável. A verificação da sua conta ainda está pendente. Este é o Lembrete ${reminderNumber} de 3. Para garantir um serviço ininterrupto, por favor verifique seu e-mail clicando aqui: ${verificationLink}`,
      };
    case 'italian':
      return {
        content: `Ciao, un promemoria amichevole. La verifica del tuo account è ancora in sospeso. Questo è il Promemoria ${reminderNumber} di 3. Per garantire un servizio ininterrotto, verifica la tua email cliccando qui: ${verificationLink}`,
      };
    case 'hebrew':
      return {
        content: `היי, תזכורת חברותית. אימות החשבון שלך עדיין ממתין. זו תזכורת ${reminderNumber} מתוך 3. כדי להבטיח שירות ללא הפסקה, אנא אמת את הדואל שלך על ידי לחיצה כאן: ${verificationLink}`,
      };
    case 'dutch':
      return {
        content: `Hoi, een vriendelijke herinnering. De verificatie van uw account is nog steeds hangende. Dit is Herinnering ${reminderNumber} van 3. Om een ononderbroken service te garanderen, gelieve uw e-mail te verifiëren door hier te klikken: ${verificationLink}`,
      };
    case 'bulgarian':
      return {
        content: `Здравейте, приятелско напомняне. Потвърждението на акаунта ви все още е предстоящо. Това е напомняне ${reminderNumber} от 3. За да гарантирате непрекъснато обслужване, моля потвърдете имейла си като кликнете тук: ${verificationLink}`,
      };
    case 'greek':
      return {
        content: `Γεια, μια φιλική υπενθύμιση. Η επαλήθευση του λογαριασμού σας είναι ακόμη εκκρεμής. Αυτή είναι η Υπενθύμιση ${reminderNumber} από 3. Για να διασφαλίσετε αδιάλειπτη υπηρεσία, παρακαλούμε επιβεβαιώστε το email σας κάνοντας κλικ εδώ: ${verificationLink}`,
      };
    case 'swedish':
      return {
        content: `Hej, en vänlig påminnelse. Din kontoverifiering är fortfarande inte klar. Detta är Påminnelse ${reminderNumber} av 3. För att säkerställa oavbruten service, vänligen verifiera din e-post genom att klicka här: ${verificationLink}`,
      };
    default:
      return {
        content: `
        Hi, a friendly reminder. Your account verification is still pending. This is Reminder ${reminderNumber} of 3. To ensure uninterrupted service, kindly verify your email by clicking here: ${verificationLink}`,
      };
  }
};

export const ClientVerification = (otp: string, language: string) => {
  const lang: any = {
    english: `Your OTP is ${otp}. Welcome to our services! Enjoy the experience!`,
    spanish: `Tu OTP es ${otp}. ¡Bienvenido a nuestros servicios! ¡Disfruta la experiencia!`,
    arabic: `رمز التحقق الخاص بك هو ${otp}. مرحبًا بك في خدماتنا! استمتع بالتجربة!`,
    french: 'Votre OTP est ${otp}. Bienvenue dans nos services ! Profitez de l`expérience !',
    german: `Ihr OTP lautet ${otp}. Willkommen bei unseren Diensten! Genießen Sie das Erlebnis!`,
    russian: `Ваш одноразовый пароль: ${otp}. Добро пожаловать в наши услуги! Наслаждайтесь опытом!`,
    portuguese: `Seu OTP é ${otp}. Bem-vindo aos nossos serviços! Aproveite a experiência!`,
    italian: 'Il tuo OTP è ${otp}. Benvenuto ai nostri servizi! Goditi l`esperienza!',
    hebrew: `ה-OTP שלך הוא ${otp}. ברוך הבא לשירותינו! תהנה מהחוויה!`,
    dutch: `Je OTP is ${otp}. Welkom bij onze diensten! Geniet van de ervaring!`,
    bulgarian: `Вашият OTP е ${otp}. Добре дошли в нашите услуги! Насладете се на преживяването!`,
    greek: `Ο κωδικός OTP σας είναι ${otp}. Καλώς ήρθατε στις υπηρεσίες μας! Απολαύστε την εμπειρία!`,
    swedish: `Din OTP är ${otp}. Välkommen till våra tjänster! Njut av upplevelsen!`,
  };
  return lang[language as any] || lang['english'];
};

export const postSuspensionMessage = (name: string, language: string) => {
  const lang: any = {
    english: `Hi ${name}, your account is suspended as your email isn't verified. Please click the verification link we sent earlier to reactivate your account. Need help? Contact our Support Team. Thank you, Support Team`,
    hebrew: `שלום ${name}, החשבון שלך מושעה מכיוון שהאימייל שלך לא אומת. אנא לחץ על קישור האימות שנשלח בעבר כדי להפעיל מחדש את חשבונך. זקוק לעזרה? צור קשר עם Support Team. תודה, Support Team`,
    arabic: `مرحبًا ${name}، تم تعليق حسابك لأن بريدك الإلكتروني غير مُفعّل. يرجى النقر على رابط التحقق الذي أرسلناه سابقًا لإعادة تفعيل حسابك. هل تحتاج مساعدة؟ اتصل بفريق Support Team. شكرًا، Support Team`,
    french: `Bonjour ${name}, votre compte est suspendu car votre email n'est pas vérifié. Veuillez cliquer sur le lien de vérification que nous avons envoyé précédemment pour réactiver votre compte. Besoin d'aide ? Contactez Support Team. Merci, Support Team`,
    german: `Hallo ${name}, Ihr Konto wurde gesperrt, da Ihre E-Mail nicht verifiziert ist. Bitte klicken Sie auf den Verifizierungslink, den wir zuvor gesendet haben, um Ihr Konto zu reaktivieren. Brauchen Sie Hilfe? Kontaktieren Sie unser Support Team. Danke, Support Team`,
    russian: `Здравствуйте, ${name}, ваш аккаунт приостановлен, так как ваш email не подтвержден. Пожалуйста, нажмите на ссылку для подтверждения, которую мы отправили ранее, чтобы активировать ваш аккаунт заново. Нужна помощь? Обратитесь в Support Team. Спасибо, Support Team`,
    portuguese: `Olá ${name}, sua conta está suspensa porque seu email não foi verificado. Por favor, clique no link de verificação que enviamos anteriormente para reativar sua conta. Precisa de ajuda? Entre em contato com o Support Team. Obrigado, Support Team`,
    italian: `Ciao ${name}, il tuo account è sospeso perché la tua email non è verificata. Per favore, clicca sul link di verifica che abbiamo inviato in precedenza per riattivare il tuo account. Hai bisogno di aiuto? Contatta Support Team. Grazie, Support Team`,
    spanish: `Hola ${name}, tu cuenta está suspendida porque tu correo electrónico no está verificado. Por favor, haz clic en el enlace de verificación que enviamos anteriormente para reactivar tu cuenta. ¿Necesitas ayuda? Contacta a Support Team. Gracias, Support Team`,
    dutch: `Hallo ${name}, uw account is geschorst omdat uw e-mail niet is geverifieerd. Klik alstublieft op de verificatielink die we eerder hebben verzonden om uw account te reactiveren. Hulp nodig? Neem contact op met Support Team. Dank u, Support Team`,
  };
  return lang[language as any] || lang['english'];
};

export const PartnerVerification = (otp: string, language: string) => {
  const lang: any = {
    english: `Your verification code is: ${otp}. Please enter this code on the website to continue. This code will expire in 10 minutes.`,
    hebrew: `קוד האימות שלך הוא: ${otp}. אנא הזן קוד זה באתר להמשך התהליך. קוד זה יפוג בעוד 10 דקות.`,
    arabic: `رمز التحقق الخاص بك هو: ${otp}. يرجى إدخال هذا الرمز على الموقع للمتابعة. سينتهي هذا الرمز خلال 10 دقائق.`,
    french: `Votre code de vérification est : ${otp}. Veuillez saisir ce code sur le site pour continuer. Ce code expirera dans 10 minutes.`,
    german: `Ihr Verifizierungscode lautet: ${otp}. Bitte geben Sie diesen Code auf der Webseite ein, um fortzufahren. Dieser Code wird in 10 Minuten ablaufen.`,
    russian: `Ваш код подтверждения: ${otp}. Пожалуйста, введите этот код на сайте для продолжения. Код истечет через 10 минут.`,
    portuguese: `Seu código de verificação é: ${otp}. Por favor, insira este código no site para continuar. Este código expirará em 10 minutos.`,
    italian: `Il tuo codice di verifica è: ${otp}. Inserisci questo codice sul sito web per continuare. Questo codice scadrà tra 10 minuti.`,
    spanish: `Tu código de verificación es: ${otp}. Por favor, introduce este código en el sitio web para continuar. Este código expirará en 10 minutos.`,
    dutch: `Uw verificatiecode is: ${otp}. Voer deze code in op de website om verder te gaan. Deze code verloopt over 10 minuten`,
    bulgarian: `Your verification code is: ${otp}. Please enter this code on the website to continue. This code will expire in 10 minutes.`,
    greek: `Your verification code is: ${otp}. Please enter this code on the website to continue. This code will expire in 10 minutes.`,
    swedish: `Your verification code is: ${otp}. Please enter this code on the website to continue. This code will expire in 10 minutes.`,
  };
  return lang[language as any] || lang['english'];
};

export const SMS_Confirmation = (language: string) => {
  const lang: any = {
    english: 'Congratulations! Your account has been successfully verified. You can now log in to your account.',
    hebrew: 'מזל טוב! החשבון שלך אומת בהצלחה. כעת תוכל להיכנס לחשבון שלך.',
    arabic: 'تهانينا! لقد تم التحقق من حسابك بنجاح. يمكنك الآن تسجيل الدخول إلى حسابك.',
    french: 'Félicitations ! Votre compte a été vérifié avec succès. Vous pouvez maintenant vous connecter à votre compte.',
    german: 'Glückwunsch! Ihr Konto wurde erfolgreich verifiziert. Sie können sich jetzt in Ihr Konto einloggen.',
    russian: 'Поздравляем! Ваш аккаунт успешно подтвержден. Теперь вы можете войти в свой аккаунт.',
    portuguese: 'Parabéns! Sua conta foi verificada com sucesso. Você pode agora fazer login em sua conta.',
    italian: 'Congratulazioni! Il tuo account è stato verificato con successo. Ora puoi accedere al tuo account.',
    spanish: '¡Felicidades! Tu cuenta ha sido verificada exitosamente. Ahora puedes iniciar sesión en tu cuenta.',
    dutch: 'Gefeliciteerd! Uw account is succesvol geverifieerd. U kunt nu inloggen op uw account.',
    bulgarian: 'Congratulations! Your account has been successfully verified. You can now log in to your account.',
    greek: 'Congratulations! Your account has been successfully verified. You can now log in to your account.',
    swedish: 'Congratulations! Your account has been successfully verified. You can now log in to your account.',
  };
  return lang[language as any] || lang['english'];
};

export const generalOTP = (language?: string, otp?: string) => {
  const countryLanguage = language ?? 'english';
  switch (countryLanguage) {
    case 'english':
      return { content: `${otp} is your OTP. Welcome to our services! Enjoy the experience!` };
    case 'spanish':
      return { content: `${otp} es tu OTP. Bienvenido a nuestros servicios! ¡Disfruta la experiencia!` };
    case 'arabic':
      return { content: `رمز التحقق الخاص بك هو ${otp}. مرحبًا بك في خدماتنا! استمتع بالتجربة!` };
    case 'french':
      return { content: `${otp} est votre OTP. Bienvenue dans nos services! Profitez de l'expérience !` };
    case 'German':
      return { content: `${otp} ist Ihr OTP. Willkommen bei unseren Diensten! Genießen Sie das Erlebnis!` };
    case 'russian':
      return { content: `${otp} — ваш одноразовый пароль. Добро пожаловать в наши услуги! Наслаждайтесь опытом!` };
    case 'portuguese':
      return { content: `${otp} é o seu OTP. Bem-vindo aos nossos serviços! Aproveite a experiência!` };
    case 'italian':
      return { content: `${otp} è il tuo OTP. Benvenuto ai nostri servizi! Goditi l'esperienza!` };
    case 'hebrew':
      return { content: `ה-OTP שלך הוא ${otp}. ברוך הבא לשירותינו! תהנה מהחוויה!` };
    case 'dutch':
      return { content: `${otp} is je OTP. Welkom bij onze diensten! Geniet van de ervaring!` };
    case 'bulgarian':
      return { content: `${otp} е вашият OTP. Добре дошли в нашите услуги! Насладете се на преживяването!` };
    case 'greek':
      return { content: `${otp} είναι ο OTP σας. Καλώς ήρθατε στις υπηρεσίες μας! Απολαύστε την εμπειρία!` };
    case 'swedish':
      return { content: `${otp} är din OTP. Välkommen till våra tjänster! Njut av upplevelsen!` };
    default:
      return {
        content: `${otp} is your OTP. Welcome to our services! Enjoy the experience!`,
      };
  }
};
