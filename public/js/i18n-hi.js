/* Hindi translations. EXACT = whole phrases; PATTERNS = phrases with changing parts in {braces}. */

export const EXACT = {
  /* ---------- shared */
  'SamiMeds': 'SamiMeds', 'Sign in': 'साइन इन', 'Sign out': 'साइन आउट', '🚪 Sign out': '🚪 साइन आउट', 'Undo': 'वापस लें', 'Cancel': 'रद्द करें',
  'Close': 'बंद करें', 'Done': 'हो गया', 'Loading': 'लोड हो रहा है', 'Add': 'जोड़ें', 'Good': 'अच्छा', 'Okay': 'ठीक-ठाक', 'Not well': 'ठीक नहीं',
  'Today': 'आज', 'Tomorrow': 'कल', 'Yesterday': 'बीता कल', 'Medicines': 'दवाइयाँ', 'Medicine': 'दवा', 'family': 'परिवार',
  'Mon': 'सोम', 'Tue': 'मंगल', 'Wed': 'बुध', 'Thu': 'गुरु', 'Fri': 'शुक्र', 'Sat': 'शनि', 'Sun': 'रवि',
  'Monday': 'सोमवार', 'Tuesday': 'मंगलवार', 'Wednesday': 'बुधवार', 'Thursday': 'गुरुवार', 'Friday': 'शुक्रवार', 'Saturday': 'शनिवार', 'Sunday': 'रविवार',
  'January': 'जनवरी', 'February': 'फ़रवरी', 'March': 'मार्च', 'April': 'अप्रैल', 'May': 'मई', 'June': 'जून', 'July': 'जुलाई',
  'August': 'अगस्त', 'September': 'सितंबर', 'October': 'अक्टूबर', 'November': 'नवंबर', 'December': 'दिसंबर',
  'Elder': 'बुज़ुर्ग', 'Family': 'परिवार', 'Caretaker': 'देखभालकर्ता', 'Son': 'बेटा', 'Daughter': 'बेटी', 'Nurse': 'नर्स',
  'just now': 'अभी-अभी', 'Something went wrong': 'कुछ गड़बड़ हो गई', 'Please sign in': 'कृपया साइन इन करें',
  'Skip to sign in': 'साइन इन पर जाएँ', 'Skip to main content': 'मुख्य भाग पर जाएँ', 'Skip to content': 'मुख्य भाग पर जाएँ',

  '😊 Good': '😊 अच्छा', '😐 Okay': '😐 ठीक-ठाक', '😟 Not well': '😟 ठीक नहीं',
  'white': 'सफ़ेद', 'yellow': 'पीला', 'orange': 'नारंगी', 'pink': 'गुलाबी', 'red': 'लाल', 'blue': 'नीला', 'green': 'हरा', 'purple': 'बैंगनी', 'brown': 'भूरा',
  'Medicines: no doses were due this week.': 'दवाइयाँ: इस हफ़्ते कोई खुराक नहीं थी।', 'No missed doses this week. 🌟': 'इस हफ़्ते कोई खुराक नहीं छूटी। 🌟',
  'Mood: no check-ins this week.': 'हाल: इस हफ़्ते कोई जानकारी नहीं।',

  /* ---------- questions */
  '✅ Your family has been asked': '✅ परिवार को बता दिया गया है', 'They will call you to explain. You can also call them now.': 'वे आपको फ़ोन करके समझाएँगे। आप भी अभी उन्हें फ़ोन कर सकते हैं।',
  'Your question': 'आपका सवाल', '✅ Answered': '✅ जवाब दे दिया', 'Sending…': 'भेजा जा रहा है…',
  'Sending the weekly summary 📧 – see the Alerts tab': 'साप्ताहिक सारांश भेजा जा रहा है 📧 – सूचनाएँ टैब देखें',
  '📧 Emails are sent through the Gmail API. Every reminder is also listed here.': '📧 ईमेल Gmail API से भेजे जाते हैं। हर रिमाइंडर यहाँ भी दिखता है।',

  /* ---------- keyboard bar & wrong-tab helper */
  'Typing shortcuts': 'टाइपिंग शॉर्टकट', 'Quick answers': 'झटपट जवाब', '▲ Prev': '▲ पिछला', '▼ Next': '▼ अगला', 'Previous box': 'पिछला खाना', 'Next box': 'अगला खाना',
  'Speak instead of typing': 'टाइप करने के बजाय बोलें', 'Close the keyboard': 'कीबोर्ड बंद करें', '📷 Scan prescription': '📷 पर्ची स्कैन करें',
  'This looks like a medicine.': 'यह दवा लगती है।', 'This looks like a doctor visit.': 'यह डॉक्टर से मुलाक़ात लगती है।', 'This looks like adding a person.': 'यह किसी को जोड़ना लगता है।',
  'Looking for a report?': 'रिपोर्ट ढूँढ रहे हैं?', 'Looking for past doses?': 'पिछली खुराकें ढूँढ रहे हैं?', 'Looking for reminders sent?': 'भेजे गए रिमाइंडर ढूँढ रहे हैं?',
  'Add it in Medicines →': 'दवाइयों में जोड़ें →', 'Book it in Visits →': 'मुलाक़ातों में तय करें →', 'Go to Circle →': 'सर्कल पर जाएँ →',
  'Open Reports →': 'रिपोर्ट खोलें →', 'Open History →': 'इतिहास खोलें →', 'Open Alerts →': 'सूचनाएँ खोलें →', 'Hide this suggestion': 'यह सुझाव छिपाएँ',
  'Moved to Visits – please check the details': 'मुलाक़ातों पर आ गए – कृपया जानकारी जाँच लें', 'Moved to Medicines – filling the form for you': 'दवाइयों पर आ गए – फ़ॉर्म भरा जा रहा है',
  'Moved to Circle – add the person here': 'सर्कल पर आ गए – यहाँ व्यक्ति जोड़ें',
  'In 3 days': '3 दिन में', 'Next week': 'अगले हफ़्ते', 'In 2 weeks': '2 हफ़्ते में', 'Heart': 'दिल', 'Sugar': 'शुगर', 'Eye': 'आँख', 'Bones': 'हड्डी', 'Nerves': 'नसें', 'Teeth': 'दाँत', 'Skin': 'त्वचा',
  'Old reports': 'पुरानी रिपोर्ट', 'BP diary': 'BP डायरी', 'Sugar diary': 'शुगर डायरी', 'Medicine list': 'दवाइयों की सूची', 'Reading glasses': 'पढ़ने का चश्मा', 'ID card': 'पहचान पत्र', 'Insurance card': 'बीमा कार्ड',
  'Routine check-up': 'नियमित जाँच', 'Follow-up': 'दोबारा दिखाना', 'Fasting – no breakfast': 'खाली पेट – नाश्ता नहीं', 'Bring fasting sugar report': 'खाली पेट शुगर रिपोर्ट लाएँ',
  'Daughter-in-law': 'बहू', 'Son-in-law': 'दामाद', 'Grandson': 'पोता', 'Granddaughter': 'पोती', 'Neighbour': 'पड़ोसी',
  /* standard instructions – also translated on the elder's screen */
  'after breakfast': 'नाश्ते के बाद', 'before breakfast': 'नाश्ते से पहले', 'after lunch': 'दोपहर के खाने के बाद', 'after dinner': 'रात के खाने के बाद',
  'at bedtime': 'सोने से पहले', 'after food': 'खाने के बाद', 'before food': 'खाने से पहले', 'with water': 'पानी के साथ', 'empty stomach': 'खाली पेट',
  'once daily': 'दिन में एक बार', 'twice a day': 'दिन में दो बार', 'three times a day': 'दिन में तीन बार', '30 tablets': '30 गोलियाँ',
  'For blood pressure': 'ब्लड प्रेशर के लिए', 'For sugar (diabetes)': 'शुगर (डायबिटीज़) के लिए', 'For heart': 'दिल के लिए', 'For cholesterol': 'कोलेस्ट्रॉल के लिए',
  'For thyroid': 'थायरॉइड के लिए', 'For pain': 'दर्द के लिए', 'For acidity': 'एसिडिटी के लिए', 'For strong bones': 'मज़बूत हड्डियों के लिए', 'For sleep': 'नींद के लिए', 'Vitamin': 'विटामिन',
  '1 tablet': '1 गोली', '½ tablet': 'आधी गोली', '2 tablets': '2 गोलियाँ', '1 capsule': '1 कैप्सूल', '1 drop in each eye': 'हर आँख में 1 बूँद', '1 puff': '1 पफ़',

  /* ---------- SOS */
  'I need help': 'मुझे मदद चाहिए', 'Send a help alert to your family now?': 'क्या अभी परिवार को मदद की सूचना भेजें?', '🆘 Yes, send': '🆘 हाँ, भेजें', 'No': 'नहीं',
  '🆘 Help alert sent': '🆘 मदद की सूचना भेज दी गई', 'Your family has been told. Someone will respond soon.': 'परिवार को बता दिया गया है। जल्द ही कोई जवाब देगा।',
  'Help is coming. Stay where you are.': 'मदद आ रही है। जहाँ हैं वहीं रहें।', 'Your family has been alerted 🆘': 'परिवार को सूचना भेज दी गई 🆘', "🏃 I'm on it": '🏃 मैं आ रहा हूँ',

  /* ---------- notifications card */
  '🔔 Notifications on this phone': '🔔 इस फ़ोन पर सूचनाएँ',
  'This browser cannot show notifications. On iPhone, first add SamiMeds to the Home Screen.': 'यह ब्राउज़र सूचनाएँ नहीं दिखा सकता। iPhone पर पहले SamiMeds को होम स्क्रीन पर जोड़ें।',
  'Notifications are not set up on this server yet.': 'इस सर्वर पर सूचनाएँ अभी चालू नहीं हैं।',
  'Notifications are blocked. Allow them in your browser settings to turn this on.': 'सूचनाएँ बंद हैं। चालू करने के लिए ब्राउज़र सेटिंग में अनुमति दें।',
  'Reminders will pop up on this phone, even when SamiMeds is closed.': 'SamiMeds बंद होने पर भी इस फ़ोन पर याद दिलाया जाएगा।',
  'Get reminders on this phone, even when SamiMeds is closed.': 'SamiMeds बंद होने पर भी इस फ़ोन पर रिमाइंडर पाएँ।',
  '🔔 Turn on notifications': '🔔 सूचनाएँ चालू करें', 'Send a test': 'जाँच भेजें', 'Turn off': 'बंद करें',
  'Notifications are on 🔔': 'सूचनाएँ चालू हैं 🔔', 'Notifications are off': 'सूचनाएँ बंद हैं', 'Test sent – check your notifications': 'जाँच भेजी गई – सूचनाएँ देखें',
  'Notifications were not allowed. You can allow them in your browser settings.': 'सूचनाओं की अनुमति नहीं मिली। ब्राउज़र सेटिंग में अनुमति दे सकते हैं।',

  /* ---------- sign in */
  "Care that remembers, so you don't have to.": 'देखभाल जो याद रखे, ताकि आपको याद न रखना पड़े।',
  'New care circle': 'नया केयर सर्कल', 'Sign in or create': 'साइन इन करें या नया बनाएँ', '👋 Try the demo – tap a person': '👋 डेमो आज़माएँ – किसी एक को चुनें',
  'Elder · PIN 2580': 'बुज़ुर्ग · पिन 2580', 'Son · PIN 1357': 'बेटा · पिन 1357', 'Nurse · PIN 2468': 'नर्स · पिन 2468',
  'Welcome back to': 'फिर से स्वागत है', 'Not your circle? Change': 'आपका सर्कल नहीं? बदलें', 'Care circle code': 'केयर सर्कल कोड',
  "It's on the card your family gave you.": 'यह उस कार्ड पर है जो परिवार ने आपको दिया।', 'Your PIN': 'आपका पिन', 'Remember this phone': 'यह फ़ोन याद रखें',
  'Number keypad': 'नंबर कीपैड', 'Delete last digit': 'आख़िरी अंक मिटाएँ',
  'Who are we caring for?': 'हम किसकी देखभाल कर रहे हैं?', 'Their name': 'उनका नाम', 'Their PIN (4–6 digits)': 'उनका पिन (4–6 अंक)',
  'Something easy for them, like a birth year.': 'कुछ आसान, जैसे जन्म का साल।', 'Their email': 'उनका ईमेल', '(optional)': '(वैकल्पिक)',
  'for their own reminders': 'उनके अपने रिमाइंडर के लिए', 'e.g. Kamla Devi': 'जैसे कमला देवी',
  'About you': 'आपके बारे में', 'Your name': 'आपका नाम', 'Relation': 'रिश्ता', 'Daughter, son, nurse…': 'बेटी, बेटा, नर्स…', 'Your email': 'आपका ईमेल',
  'Missed-dose alerts go here.': 'दवा छूटने की सूचना यहाँ आएगी।', 'Your phone': 'आपका फ़ोन', 'For their big “Call” button.': 'उनके बड़े “कॉल” बटन के लिए।',
  'Your PIN (4–6 digits)': 'आपका पिन (4–6 अंक)', 'Time zone': 'समय क्षेत्र', 'Create care circle ✨': 'केयर सर्कल बनाएँ ✨',
  'Your care circle is ready!': 'आपका केयर सर्कल तैयार है!', 'Write this code down for': 'यह कोड लिख लें:',
  '. Everyone in the family uses it with their own PIN.': '। परिवार का हर सदस्य इसे अपने पिन के साथ इस्तेमाल करेगा।',
  'Open the family dashboard': 'परिवार डैशबोर्ड खोलें',
  '🔒 PINs are encrypted. Only people in the circle can see the care details.': '🔒 पिन सुरक्षित हैं। देखभाल की जानकारी केवल सर्कल के लोग देख सकते हैं।',
  'Please enter your care circle code.': 'कृपया अपना केयर सर्कल कोड डालें।', 'Your PIN has 4 to 6 numbers.': 'आपके पिन में 4 से 6 अंक हैं।',
  'Too many wrong PINs. Please wait 15 minutes.': 'बहुत बार ग़लत पिन। कृपया 15 मिनट रुकें।', 'Too many attempts. Please wait 15 minutes.': 'बहुत ज़्यादा कोशिशें। कृपया 15 मिनट रुकें।',

  /* ---------- elder: tabs & header */
  'Doctor': 'डॉक्टर', 'My day': 'मेरा दिन', 'Help': 'मदद', 'Sections': 'भाग', 'Hello': 'नमस्ते',
  'Make text bigger': 'अक्षर बड़े करें', 'Read this screen aloud': 'यह स्क्रीन पढ़कर सुनाएँ',
  'Good morning': 'सुप्रभात', 'Good afternoon': 'नमस्ते', 'Good evening': 'शुभ संध्या', 'Good night': 'शुभ रात्रि',
  'Normal text size': 'सामान्य अक्षर', 'Bigger text': 'बड़े अक्षर', 'Biggest text': 'सबसे बड़े अक्षर',

  /* ---------- elder: medicines */
  'made a change:': 'ने एक बदलाव किया:', 'A change from your family': 'परिवार की ओर से बदलाव', '👍 OK': '👍 ठीक है', '❓ I have a question': '❓ मुझे कुछ पूछना है',
  'Now': 'अभी', "It's a little late, but you can still take it.": 'थोड़ी देर हो गई है, पर आप अब भी ले सकते हैं।',
  '✅ I took it': '✅ मैंने ले ली', '📷 I took it – send a photo to family': '📷 ले ली – परिवार को फ़ोटो भेजें',
  '⏰ Remind me in 15 min': '⏰ 15 मिनट में याद दिलाएँ', '🔊 Read aloud': '🔊 पढ़कर सुनाएँ',
  'All medicines done today!': 'आज की सारी दवाइयाँ हो गईं!', 'Nothing to take right now': 'अभी कोई दवा नहीं लेनी', 'Enjoy your day 💛': 'आपका दिन शुभ हो 💛',
  "Today's medicines": 'आज की दवाइयाँ', 'No medicines for today. Your family can add them.': 'आज कोई दवा नहीं। परिवार इन्हें जोड़ सकता है।',
  'No medicines today': 'आज कोई दवा नहीं', 'Wonderful – all done! 🌟': 'बहुत बढ़िया – सब हो गया! 🌟', "Let's start the day well 💪": 'चलिए दिन की अच्छी शुरुआत करें 💪',
  'Doing great, keep going! 💚': 'बहुत अच्छे, ऐसे ही चलते रहें! 💚',
  '✅ Taken': '✅ ले ली', '⚠️ Missed': '⚠️ छूट गई', '➖ Skipped': '➖ छोड़ी गई', '⏰ Soon': '⏰ थोड़ी देर में', '⏳ Now': '⏳ अभी', '🕒 Later': '🕒 बाद में',
  '✅ Took it': '✅ ले ली', '📷 Photo sent': '📷 फ़ोटो भेजी गई', '👍 Family saw your photo': '👍 परिवार ने फ़ोटो देख ली', '📷 Send photo': '📷 फ़ोटो भेजें',
  'Photo sent to your family 📷': 'फ़ोटो परिवार को भेज दी गई 📷', 'Okay, changed back.': 'ठीक है, वापस बदल दिया।', 'Thank you 👍': 'धन्यवाद 👍',
  "We've asked your family to call you 📞": 'हमने परिवार से आपको फ़ोन करने को कहा है 📞', "Can't connect right now. We'll try again soon.": 'अभी संपर्क नहीं हो पा रहा। थोड़ी देर में फिर कोशिश करेंगे।',
  'your medicine': 'अपनी दवा', 'Please ask family to change this': 'इसे बदलने के लिए परिवार से कहें', 'Snooze limit reached': 'अब और टाला नहीं जा सकता',

  /* ---------- elder: doctor */
  'No doctor visits booked': 'डॉक्टर से कोई मुलाक़ात तय नहीं', 'Your family will add them here.': 'परिवार इन्हें यहाँ जोड़ेगा।', 'Things to bring': 'साथ ले जाने की चीज़ें',
  '📅 Add to Google Calendar': '📅 Google Calendar में जोड़ें', 'Later visits': 'आगे की मुलाक़ातें',
  'Heart doctor': 'दिल के डॉक्टर', 'Sugar / hormone doctor': 'शुगर के डॉक्टर', 'Sugar doctor': 'शुगर के डॉक्टर', 'Bone & joint doctor': 'हड्डी के डॉक्टर',
  'Eye doctor': 'आँखों के डॉक्टर', 'Nerve & brain doctor': 'नसों के डॉक्टर', 'Kidney doctor': 'गुर्दे के डॉक्टर', 'Lung doctor': 'फेफड़ों के डॉक्टर',
  'Skin doctor': 'त्वचा के डॉक्टर', 'Ear, nose & throat doctor': 'कान-नाक-गले के डॉक्टर', 'Teeth doctor': 'दाँतों के डॉक्टर', 'Family doctor': 'पारिवारिक डॉक्टर',
  'No doctor visits are booked.': 'डॉक्टर से कोई मुलाक़ात तय नहीं है।',

  /* ---------- elder: my day */
  'How are you feeling today?': 'आज आप कैसा महसूस कर रहे हैं?', 'Tap one. Your family will see it.': 'एक चुनें। परिवार इसे देखेगा।', 'Choose your mood': 'अपना हाल चुनें',
  'So happy to hear that! 💛': 'यह सुनकर बहुत ख़ुशी हुई! 💛', 'Take it easy today. 🌿': 'आज आराम से रहिए। 🌿', "We've let your family know 💛": 'हमने परिवार को बता दिया है 💛',
  'This week': 'इस हफ़्ते', 'Your family has been told 💛': 'परिवार को बता दिया गया है 💛', 'Thank you for telling us!': 'बताने के लिए धन्यवाद!',
  'How are you feeling today? Tap good, okay, or not well.': 'आज आप कैसा महसूस कर रहे हैं? अच्छा, ठीक-ठाक, या ठीक नहीं – एक चुनें।',
  'Sip some water': 'थोड़ा पानी पिएँ', 'A glass of water now and then keeps you fresh.': 'बीच-बीच में एक गिलास पानी आपको तरोताज़ा रखता है।',
  'A little walk': 'थोड़ी सैर', 'Ten slow minutes outside is good for the heart.': 'बाहर दस मिनट की धीमी सैर दिल के लिए अच्छी है।',
  'Morning sunshine': 'सुबह की धूप', 'A few minutes of sun helps your bones.': 'कुछ मिनट की धूप हड्डियों के लिए अच्छी है।',
  'Call a friend': 'किसी दोस्त को फ़ोन करें', 'A chat with someone you love brightens the day.': 'अपनों से बात करने से दिन अच्छा बन जाता है।',
  'Deep breaths': 'गहरी साँसें', 'Breathe in slowly… and out. Do it 5 times.': 'धीरे-धीरे साँस लें… और छोड़ें। ऐसा 5 बार करें।',
  'Fresh fruit': 'ताज़ा फल', 'A piece of fruit is a sweet, healthy snack.': 'एक फल मीठा और सेहतमंद नाश्ता है।',
  'Rest well': 'अच्छा आराम', 'A short afternoon rest is perfectly fine.': 'दोपहर में थोड़ा आराम करना बिल्कुल ठीक है।',

  /* ---------- elder: help */
  'Ask your family to add an emergency phone number.': 'परिवार से आपातकालीन फ़ोन नंबर जोड़ने को कहें।', 'Call someone': 'किसी को फ़ोन करें',
  'Text size': 'अक्षरों का आकार', 'Normal text': 'सामान्य अक्षर', 'Biggest text ': 'सबसे बड़े अक्षर', 'Reading voice speed': 'पढ़ने की आवाज़ की गति',
  '🐢 Slower': '🐢 धीमी', '🙂 Normal': '🙂 सामान्य', '📋 Full details': '📋 पूरी जानकारी', 'This is how I will read to you.': 'मैं आपको इस तरह पढ़कर सुनाऊँगी।',
  'Tap the big red button to call your family.': 'परिवार को फ़ोन करने के लिए बड़ा लाल बटन दबाएँ।',

  /* ---------- family: header & tabs */
  "👵 Elder's screen": '👵 बुज़ुर्ग की स्क्रीन', 'Care circle': 'केयर सर्कल', 'Dashboard sections': 'डैशबोर्ड के भाग', 'SamiMeds home': 'SamiMeds होम',
  '🏠 Overview': '🏠 सारांश', '💊 Medicines': '💊 दवाइयाँ', '🩺 Visits': '🩺 मुलाक़ातें', '📈 History': '📈 इतिहास', '🔔 Alerts': '🔔 सूचनाएँ', '👪 Circle': '👪 सर्कल', '📄 Reports': '📄 रिपोर्ट',

  /* ---------- family: overview */
  'Needs attention': 'ध्यान दें', '💚 All calm. Nothing needs your attention right now.': '💚 सब ठीक है। अभी किसी बात पर ध्यान देने की ज़रूरत नहीं।',
  'Taken today': 'आज ली गईं', '7-day adherence': '7 दिन का पालन', 'Missed this week': 'इस हफ़्ते छूटीं', 'Day streak': 'लगातार दिन', 'Mood today': 'आज का हाल',
  'No visit booked': 'कोई मुलाक़ात तय नहीं', '📞 Give them a call': '📞 उन्हें फ़ोन करें', 'Refill': 'दोबारा भरें',
  '🕒 Upcoming': '🕒 आने वाली', '⏰ Snoozed': '⏰ टाली गई', 'Mark taken': 'ली गई दर्ज करें', 'Skip': 'छोड़ें', 'Last 7 days': 'पिछले 7 दिन', 'Recent changes': 'हाल के बदलाव',
  'No medicines yet. Add them in the Medicines tab.': 'अभी कोई दवा नहीं। दवाइयाँ टैब में जोड़ें।', 'Marked as taken': 'ली गई दर्ज हुई', 'Changed back': 'वापस बदला गया', 'Dose skipped': 'खुराक छोड़ी गई',
  '👍 Seen': '👍 देख लिया', '❓ Has a question': '❓ सवाल है',
  '📷 Photo waiting for check': '📷 फ़ोटो जाँच के इंतज़ार में', 'View photo': 'फ़ोटो देखें', '✅ Looks right': '✅ सही है', '⚠️ Not right': '⚠️ सही नहीं',
  'Waiting for family to check': 'परिवार की जाँच का इंतज़ार', 'Photo verified ✅': 'फ़ोटो की पुष्टि हुई ✅', 'Marked for a second look': 'दोबारा देखने के लिए दर्ज', 'Open the photo in full size': 'फ़ोटो बड़े आकार में खोलें',

  /* ---------- family: medicines */
  '＋ Add medicine': '＋ दवा जोड़ें', '📷 Scan a prescription': '📷 पर्ची स्कैन करें', '💊 No medicines yet.': '💊 अभी कोई दवा नहीं।',
  'Tap “Add medicine” – you can just describe it in plain words.': '“दवा जोड़ें” दबाएँ – आप इसे आसान शब्दों में बता सकते हैं।',
  '✏️ Edit': '✏️ बदलें', '📦 Refill': '📦 दोबारा भरें', '🛑 Stop': '🛑 बंद करें', 'e.g. 30': 'जैसे 30',
  'Add medicine': 'दवा जोड़ें', '✨ Quick add – just describe it': '✨ झटपट जोड़ें – बस बता दें', '✨ Fill the form for me': '✨ मेरे लिए फ़ॉर्म भरें',
  'Medicine name *': 'दवा का नाम *', 'Strength': 'मात्रा (ताक़त)', 'What to take each time': 'हर बार क्या लेना है', "Shown big on the elder's screen.": 'बुज़ुर्ग की स्क्रीन पर बड़ा दिखेगा।',
  "What it's for (simple words)": 'किसलिए है (आसान शब्दों में)', 'How to take it': 'कैसे लेनी है', 'Times each day *': 'रोज़ के समय *', '＋ Add a time': '＋ समय जोड़ें',
  'Colour': 'रंग', 'Type': 'प्रकार', 'Round tablet': 'गोल गोली', 'Oval tablet': 'अंडाकार गोली', 'Capsule': 'कैप्सूल', 'Drops': 'बूँदें', 'Syrup / liquid': 'सिरप / तरल',
  'Injection': 'इंजेक्शन', 'Inhaler': 'इनहेलर', 'Pills in stock': 'बची हुई गोलियाँ', 'Pills per dose': 'एक खुराक में गोलियाँ', 'Refill alert (days left)': 'रीफ़िल सूचना (बचे दिन)',
  'optional': 'वैकल्पिक', '📷 Photo of the pill or strip': '📷 गोली या पत्ते की फ़ोटो',
  'Elders recognise what a pill looks like more easily than its name.': 'बुज़ुर्ग दवा को नाम से ज़्यादा उसकी शक्ल से पहचानते हैं।',
  'Save medicine': 'दवा सहेजें', 'Dose time': 'खुराक का समय', 'Remove this time': 'यह समय हटाएँ', 'Type a short description first.': 'पहले छोटा-सा विवरण लिखें।', 'Reading…': 'पढ़ रहे हैं…',
  '✨ Filled by Gemini – please check it': '✨ Gemini ने भरा – कृपया जाँच लें', '✨ Filled – please check it': '✨ भर दिया – कृपया जाँच लें',
  'Please enter the medicine name.': 'कृपया दवा का नाम लिखें।', 'Please add at least one time.': 'कृपया कम से कम एक समय जोड़ें।', 'Medicine updated': 'दवा बदली गई',
  '📷 Prescription scan': '📷 पर्ची स्कैन', 'Reading the prescription with Gemini…': 'Gemini पर्ची पढ़ रहा है…', 'Reading the prescription': 'पर्ची पढ़ी जा रही है',
  'No medicines could be read from that photo. Try a clearer, well-lit picture.': 'इस फ़ोटो से कोई दवा नहीं पढ़ी जा सकी। साफ़ और रोशनी वाली फ़ोटो लें।',
  '＋ Add': '＋ जोड़ें', '✏️ Edit first': '✏️ पहले बदलें', '✅ Added': '✅ जुड़ गई',
  'Prescription scan needs a Gemini API key on the server.': 'पर्ची स्कैन के लिए सर्वर पर Gemini API कुंजी चाहिए।',
  'Could not read that photo. Please try a clearer picture, or add the medicine by hand.': 'फ़ोटो नहीं पढ़ी जा सकी। साफ़ फ़ोटो लें, या दवा हाथ से जोड़ें।',

  /* ---------- family: visits */
  'Doctor visits': 'डॉक्टर से मुलाक़ातें', '＋ Book a visit': '＋ मुलाक़ात तय करें',
  'Reminder emails go out the day before and on the morning of each visit.': 'हर मुलाक़ात से एक दिन पहले और उसी सुबह रिमाइंडर ईमेल जाता है।',
  '🩺 No upcoming visits.': '🩺 आगे कोई मुलाक़ात नहीं।', 'Past & cancelled': 'पुरानी और रद्द', '📅 Google Calendar': '📅 Google Calendar', '✅ Done': '✅ हो गई',
  'Cancel visit': 'मुलाक़ात रद्द करें', '🗑️ Delete': '🗑️ हटाएँ', 'Book a doctor visit': 'डॉक्टर से मुलाक़ात तय करें', 'Edit visit': 'मुलाक़ात बदलें',
  'Doctor *': 'डॉक्टर *', 'Specialty': 'विशेषज्ञता', 'Date *': 'तारीख़ *', 'Time *': 'समय *', 'Where': 'कहाँ', 'Clinic name and address': 'क्लिनिक का नाम और पता',
  'Things to bring (one per line)': 'साथ ले जाने की चीज़ें (हर पंक्ति में एक)', 'Notes': 'टिप्पणी', 'Save visit': 'मुलाक़ात सहेजें',
  'Doctor, date and time are needed.': 'डॉक्टर, तारीख़ और समय ज़रूरी हैं।', 'Visit updated': 'मुलाक़ात बदली गई', 'Visit booked 🩺': 'मुलाक़ात तय हुई 🩺',
  'Marked as done': 'हो गई दर्ज', 'Visit cancelled': 'मुलाक़ात रद्द हुई', 'Deleted': 'हटाया गया',

  /* ---------- family: history */
  'History': 'इतिहास', 'Time range': 'समय सीमा', '7 days': '7 दिन', '14 days': '14 दिन', '30 days': '30 दिन', 'Doses taken': 'ली गई खुराकें',
  'On time (within 30 min)': 'समय पर (30 मिनट के अंदर)', 'Missed': 'छूटीं', 'Mood check-ins': 'हाल की जानकारी', 'Each day': 'हर दिन', 'By medicine': 'दवा के अनुसार',
  'Mood': 'हाल', 'No check-ins yet.': 'अभी कोई जानकारी नहीं।', 'Dose log': 'खुराक का रिकॉर्ड', 'Showing the last 14 days in the chart.': 'चार्ट में पिछले 14 दिन दिख रहे हैं।',
  'Date': 'तारीख़', 'Time': 'समय', 'Status': 'स्थिति', 'By': 'किसने', 'Late': 'देरी', '🕒 Pending': '🕒 बाक़ी',

  /* ---------- family: alerts */
  'Reminders & alerts': 'रिमाइंडर और सूचनाएँ', '📧 Emails are being sent. Every reminder is also listed here.': '📧 ईमेल भेजे जा रहे हैं। हर रिमाइंडर यहाँ भी दिखता है।',
  "📧 Email sending isn't set up on this server, so reminders are listed here instead of being sent.": '📧 इस सर्वर पर ईमेल चालू नहीं है, इसलिए रिमाइंडर भेजने के बजाय यहाँ दिखाए जाते हैं।',
  'How it works: a reminder 10 min before each dose → a gentle second reminder 30 min after → family is emailed if it is still not taken after 1 hour.': 'यह कैसे काम करता है: हर खुराक से 10 मिनट पहले रिमाइंडर → 30 मिनट बाद दूसरा हल्का रिमाइंडर → 1 घंटे बाद भी न लेने पर परिवार को ईमेल।',
  '🔕 No reminders yet.': '🔕 अभी कोई रिमाइंडर नहीं।', 'Sent': 'भेजा गया', 'Only family and caretakers can see the reminder log.': 'रिमाइंडर का रिकॉर्ड केवल परिवार और देखभालकर्ता देख सकते हैं।',
  'Email not configured – shown here only': 'ईमेल चालू नहीं – केवल यहाँ दिखाया गया', 'No email address on file': 'कोई ईमेल पता दर्ज नहीं',

  /* ---------- family: circle */
  '＋ Add someone to the circle': '＋ सर्कल में किसी को जोड़ें', 'Name *': 'नाम *', 'Role': 'भूमिका', 'Caretaker / nurse': 'देखभालकर्ता / नर्स', 'Son, nurse…': 'बेटा, नर्स…',
  'Email': 'ईमेल', 'for alerts': 'सूचनाओं के लिए', 'Phone': 'फ़ोन', 'Their PIN (4–6 digits) *': 'उनका पिन (4–6 अंक) *', 'Add to circle': 'सर्कल में जोड़ें',
  '⚙️ Circle settings': '⚙️ सर्कल सेटिंग', "Elder's name": 'बुज़ुर्ग का नाम', 'Emergency contact name': 'आपातकालीन संपर्क का नाम', 'Emergency phone (big red button)': 'आपातकालीन फ़ोन (बड़ा लाल बटन)',
  'Save settings': 'सेटिंग सहेजें', '🔑 Change my PIN': '🔑 मेरा पिन बदलें', 'New PIN (4–6 digits)': 'नया पिन (4–6 अंक)', 'Update PIN': 'पिन बदलें',
  '🕘 Activity log': '🕘 गतिविधि रिकॉर्ड', 'Every change is recorded, and the elder can say “OK” or “I have a question”.': 'हर बदलाव दर्ज होता है, और बुज़ुर्ग “ठीक है” या “मुझे कुछ पूछना है” कह सकते हैं।',
  'Remove': 'हटाएँ', 'Added to the circle 👪': 'सर्कल में जोड़ा गया 👪', 'Settings saved': 'सेटिंग सहेजी गई', 'Your PIN was changed': 'आपका पिन बदल गया',

  /* ---------- family: reports */
  'Reports': 'रिपोर्ट', '📊 Weekly summary': '📊 साप्ताहिक सारांश', 'Sent automatically every Sunday evening to family and caretakers.': 'हर रविवार शाम परिवार और देखभालकर्ताओं को अपने-आप भेजा जाता है।',
  '🩺 For the doctor': '🩺 डॉक्टर के लिए',
  'A clean one-page summary: medicines, how well they were taken in the last 30 days, missed doses, mood and recent visits.': 'एक पन्ने का साफ़ सारांश: दवाइयाँ, पिछले 30 दिनों में कितनी ली गईं, छूटी खुराकें, हाल और हाल की मुलाक़ातें।',
  '🖨️ Open printable summary': '🖨️ छापने लायक सारांश खोलें', 'Weekly summary sent 📧': 'साप्ताहिक सारांश भेजा गया 📧',
};

export const PATTERNS = [
  /* dates & greetings */
  ['{greet}, {name} ☀️', '{greet}, {name} ☀️'], ['{greet}, {name} 🌤️', '{greet}, {name} 🌤️'], ['{greet}, {name} 🌇', '{greet}, {name} 🌇'], ['{greet}, {name} 🌙', '{greet}, {name} 🌙'],
  ["{name}'s circle", '{name} का सर्कल'], ["{name}'s care circle", '{name} का केयर सर्कल'], ['Circle {code}', 'सर्कल {code}'],
  ['{name} · {role} · Circle code {code}', '{name} · {role} · सर्कल कोड {code}'], ['Circle code: {code}', 'सर्कल कोड: {code}'],
  ["That PIN didn't match. {n} tries left.", 'पिन मेल नहीं खाया। {n} कोशिशें बाक़ी हैं।'], ['Too many wrong PINs. Try again in {n} minutes.', 'बहुत बार ग़लत पिन। {n} मिनट बाद कोशिश करें।'],

  /* elder */
  ['💬 {name}', '💬 {name}'], ['In {n} min', '{n} मिनट में'], ['{n} min ago', '{n} मिनट पहले'], ['{h} h {m} min late', '{h} घंटे {m} मिनट देर'], ['In {n} days', '{n} दिन में'],
  ['Take {what}', '{what} लें'], ['🍽️ {how}', '🍽️ {how}'], ['💜 {why}', '💜 {why}'], ["⏰ I'll remind you soon about {name}.", '⏰ {name} के लिए थोड़ी देर में याद दिलाऊँगी।'],
  ['Next: {time} – {name}', 'अगली: {time} – {name}'], ['{a} of {b} taken today', 'आज {b} में से {a} ली गईं'], ['{a} of {b} medicines taken today', 'आज {b} में से {a} दवाइयाँ ली गईं'],
  ['🌟 {n} day in a row', '🌟 लगातार {n} दिन'], ['🌟 {n} days in a row', '🌟 लगातार {n} दिन'],
  ['Wonderful! {name} marked as taken ✅', 'बहुत बढ़िया! {name} ली गई दर्ज हुई ✅'], ["Okay! I'll remind you in {n} minutes ⏰", 'ठीक है! {n} मिनट में याद दिलाऊँगी ⏰'],
  ['I took {name}', 'मैंने {name} ले ली'], ['Send a photo for {name}', '{name} की फ़ोटो भेजें'],
  ['🗓️ {day}, {time}', '🗓️ {day}, {time}'], ['🗓️ {wd}, {d} {month}, {time}', '🗓️ {wd}, {d} {month}, {time}'], ['🩺 {specialty}', '🩺 {specialty}'],
  ['📞 Call {name}', '📞 {name} को फ़ोन करें'], ['Call {name} now', '{name} को अभी फ़ोन करें'], ["Today's little idea: {idea}", 'आज का छोटा सुझाव: {idea}'],
  ['{weekday}: no answer', '{weekday}: कोई जवाब नहीं'],
  ['At {time}, please take {what}.', '{time} बजे, कृपया {what} लें।'], ['Remember: {how}.', 'ध्यान रखें: {how}।'],
  ['You have taken {a} of {b} medicines today.', 'आज आपने {b} में से {a} दवाइयाँ ले ली हैं।'], ['Next is {name} at {time}.', 'अगली दवा {name} है, {time} बजे।'],
  ['Your next doctor visit is {day} at {time} with {doctor}.', 'डॉक्टर से आपकी अगली मुलाक़ात {day} {time} बजे {doctor} के साथ है।'],
  ['At {place}.', 'जगह: {place}।'], ['Please bring: {things}.', 'कृपया साथ लाएँ: {things}।'],

  /* family */
  ['Today · {date}', 'आज · {date}'], ['⏳ Due {n} min ago', '⏳ {n} मिनट पहले लेनी थी'], ['by {name}, {n} min late', '{name} ने, {n} मिनट देर से'], ['by {name}', '{name} ने'],
  ['🛒 {name} is running low – about {n} day(s) left.', '🛒 {name} कम बची है – लगभग {n} दिन की।'],
  ["⚠️ {name} at {time} hasn't been confirmed.", '⚠️ {time} की {name} की पुष्टि नहीं हुई।'],
  ['😟 {name} said they are not feeling well today ({when}).', '😟 {name} ने बताया कि आज तबीयत ठीक नहीं है ({when})।'],
  ['❓ {name} has a question about: “{what}”', '❓ {name} का सवाल है: “{what}”'],
  ['📷 {name} sent a photo: {med} ({time})', '📷 {name} ने फ़ोटो भेजी: {med} ({time})'], ['📷 Verified by {name}', '📷 {name} ने पुष्टि की'], ['📷 Needs a check ({name})', '📷 जाँच ज़रूरी ({name})'],
  ['Photo sent by {name} for {med}', '{med} के लिए {name} की भेजी फ़ोटो'],
  ['{n} min ago', '{n} मिनट पहले'], ['{n} h ago', '{n} घंटे पहले'], ['🌟 {n}', '🌟 {n}'],
  ['📦 {n} left · about {d} day(s)', '📦 {n} बची · लगभग {d} दिन'], ['🛒 {n} left · about {d} day(s)', '🛒 {n} बची · लगभग {d} दिन'],
  ['Edit {name}', '{name} बदलें'], ['{name} added 💊', '{name} जोड़ी गई 💊'], ['{name} stopped', '{name} बंद की गई'], ['Stock updated for {name}', '{name} का स्टॉक बदला गया'],
  ['Pills to add for {name}', '{name} के लिए गोलियाँ जोड़ें'],
  ['Gemini found {n} medicine(s). Please check each one against the prescription before adding.', 'Gemini को {n} दवा(एँ) मिलीं। जोड़ने से पहले हर एक को पर्ची से मिला लें।'],
  ['🗓️ {date}, {time}', '🗓️ {date}, {time}'], ['✅ Done · {date}', '✅ हो गई · {date}'], ['✕ Cancelled · {date}', '✕ रद्द · {date}'],
  ['📧 Email it now to {n} people', '📧 अभी {n} लोगों को ईमेल करें'], ['{name} removed', '{name} हटाए गए'],
  ['{n}/{m} packed', '{n}/{m} रख लिया'], ['{name} (you)', '{name} (आप)'],
  ["Couldn't load this section: {why}", 'यह भाग लोड नहीं हो सका: {why}'],

];

/* Patterns built from lists, so only real weekdays / day words match. */
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS_SHORT = { Jan: 'जन', Feb: 'फ़र', Mar: 'मार्च', Apr: 'अप्रैल', May: 'मई', Jun: 'जून', Jul: 'जुलाई', Aug: 'अग', Sep: 'सित', Oct: 'अक्टू', Nov: 'नवं', Dec: 'दिसं' };
for (const day of WEEKDAYS) {
  PATTERNS.push([`${day}, {day} {month}`, `${EXACT[day]}, {day} {month}`]);
  for (const mood of ['Good', 'Okay', 'Not well']) EXACT[`${day}: ${mood}`] = `${EXACT[day]}: ${EXACT[mood]}`;
}
for (const [en, hi] of Object.entries(MONTHS_SHORT)) {
  EXACT[en] = hi;
  PATTERNS.push([`{d} ${en}`, `{d} ${hi}`], [`{wd}, {d} ${en}, {time}`, `{wd}, {d} ${hi}, {time}`], [`{wd}, {d} ${en}`, `{wd}, {d} ${hi}`]);
}
for (const day of ['Today', 'Tomorrow', 'Yesterday']) PATTERNS.push([`${day}, {time}`, `${EXACT[day]}, {time}`]);

PATTERNS.push(
  ['💚 {name} is on the way', '💚 {name} आ रहे हैं'], ['🆘 {name} asked for help', '🆘 {name} ने मदद माँगी'],
  ["{name} will see that you're on the way 💚", '{name} को दिख जाएगा कि आप आ रहे हैं 💚'],
  ["💚 {who} is responding to {name}'s help alert ({when}).", '💚 {who}, {name} की मदद की सूचना पर जवाब दे रहे हैं ({when})।'],
  ['You asked about: {what}', 'आपने पूछा था: {what}'], ['About: {what}', 'विषय: {what}'], ['💚 {name} answered your question', '💚 {name} ने आपके सवाल का जवाब दिया'],
  ['✅ Answered by {name}', '✅ {name} ने जवाब दिया'], ['📞 Call {name}', '📞 {name} को फ़ोन करें'], ['{name} will see that you answered 💚', '{name} को दिख जाएगा कि आपने जवाब दे दिया 💚'], [' · {when}', ' · {when}'],
  ['In {n} days, {time}', '{n} दिन में, {time}'], ['{n} min', '{n} मिनट'], ['Dose log for the last {n} days', 'पिछले {n} दिनों का खुराक रिकॉर्ड'],
  ['{a} · {b}', '{a} · {b}'], ['👪 {name} ({rel})', '👪 {name} ({rel})'], ['🧑‍⚕️ {name} ({rel})', '🧑‍⚕️ {name} ({rel})'],
  /* text written by the server */
  ['Weekly summary for {name} ({from} – {to}).', '{name} का साप्ताहिक सारांश ({from} – {to})।'],
  ['Medicines: {a} of {b} doses taken ({p}%), {c} on time.', 'दवाइयाँ: {b} में से {a} खुराकें ली गईं ({p}%), {c} समय पर।'],
  ['Missed: {list}.', 'छूटीं: {list}।'], ['Mood: {list}.', 'हाल: {list}।'], ['Running low: {list}.', 'कम बची हैं: {list}।'],
  ['Doctor visits: {n} done, next is {doc} on {date} at {time}.', 'डॉक्टर से मुलाक़ातें: {n} हुईं, अगली {doc} के साथ {date} को {time} बजे।'],
  ['Doctor visits: {n} done, none booked.', 'डॉक्टर से मुलाक़ातें: {n} हुईं, आगे कोई तय नहीं।'],
  ['Added {what} at {time}', '{what} जोड़ी गई, समय {time}'], ['Stopped {what}', '{what} बंद की गई'], ['Booked {doc} on {date} at {time}', '{doc} से मुलाक़ात तय: {date}, {time}'],
  ['Marked {what} as taken', '{what} ली गई दर्ज की'], ['Added {name} as {role}', '{name} को {role} के रूप में जोड़ा'], ['Removed {name}', '{name} को हटाया'],
  ['Care circle created for {name}', '{name} के लिए केयर सर्कल बनाया गया'],
);
