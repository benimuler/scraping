'use strict';

/**
 * מרכיב את כל מקורות התוכן לחבילות שהשרת טוען.
 *
 * המקורות מחזירים צורות שונות — אמוג'י, SVG משורטט, או רמז מילולי — וכאן
 * הם מתנרמלים לפורמט אחד: קובץ תמונה תחת content/media, או שדה text.
 */

const fs = require('fs');
const path = require('path');

const { emojiSvg } = require('./svg');
const emoji = require('./emoji');
const text = require('./text');
const countries = require('./countries');
const drawn = require('./drawn');
const flags = require('./flags');
const generated = require('./generated');
const numeric = require('./numeric');
const photos = require('./photos');
const { enrichPhotos } = (() => {


// Reviewed photographs can deepen the matching older emoji pools without
// changing their subject or the image-answer game. Reuse full source credits.
const EXTRA = {
  "signs": [
    [
      "שלט מתומן אדום בצומת: מה ההוראה?",
      "עצור"
    ],
    [
      "עיגול אדום עם פס לבן לרוחבו: מה ההוראה?",
      "אין כניסה"
    ],
    [
      "האות P על שלט כחול: מה מותר במקום?",
      "חניה"
    ],
    [
      "משולש עם סימן קריאה: מה מטרת השלט?",
      "אזהרה"
    ],
    [
      "עיגול אדום עם קו אלכסוני מעל פעולה: מה הוא מסמל?",
      "איסור"
    ],
    [
      "סיגריה ועליה קו אלכסוני: מה ההוראה?",
      "אסור לעשן"
    ],
    [
      "צלליות של גבר ואישה על דלת: לאיזה חדר?",
      "שירותים"
    ],
    [
      "שלושה חצים רודפים זה אחר זה במשולש: מה התהליך?",
      "מיחזור"
    ],
    [
      "דמויות ילדים על שלט ליד בית ספר: מה האזהרה?",
      "זהירות ילדים"
    ],
    [
      "ברז וכוס על שלט, ללא קו איסור: מה מותר לשתות?",
      "מי שתייה"
    ],
    [
      "מכל כיבוי אש על שלט: מה נמצא כאן?",
      "מטף"
    ],
    [
      "שלושה להבים שחורים סביב עיגול על רקע צהוב: איזו סכנה?",
      "קרינה"
    ],
    [
      "טלפון נייד ועליו קו איסור: מה מבקשים?",
      "כבו טלפונים"
    ],
    [
      "כיסא גלגלים לבן על שלט כחול: מה מסומן?",
      "נגישות"
    ],
    [
      "ברק על ארון מתח גבוה: איזו אזהרה?",
      "סכנת חשמל"
    ],
    [
      "הולך רגל ועליו פס אדום אלכסוני: מה אסור?",
      "אין מעבר להולכי רגל"
    ],
    [
      "האותיות SOS: מה משמעות האיתות?",
      "קריאת מצוקה"
    ],
    [
      "רמקול ועליו קו אלכסוני: איזה מצב שמע?",
      "השתקה"
    ],
    [
      "אדם זורק פסולת למכל: מה ההוראה?",
      "השלך לפח"
    ],
    [
      "עמדת שוטר עם מסמך בנמל תעופה: איזו בדיקה?",
      "ביקורת דרכונים"
    ],
    [
      "סמל כיסא גלגלים ליד כניסה לבניין: איזה מאפיין של הכניסה?",
      "נגישות"
    ],
    [
      "סמל סיגריה מחוקה בחדר המתנה: מה אסור לעשות?",
      "אסור לעשן"
    ],
    [
      "השלט ליד מכל לכיבוי שריפה מציין איזה מכשיר?",
      "מטף"
    ],
    [
      "שלט SOS בצד הדרך מזמין לשלוח איזו הודעה?",
      "קריאת מצוקה"
    ],
    [
      "סמל של רמקול מחוק בשיחת וידאו: איזה מצב?",
      "השתקה"
    ],
    [
      "הסמל של שלושה חצים על אריזה מתייחס לאיזה תהליך?",
      "מיחזור"
    ]
  ],
  "elements": [
    [
      "Cd",
      "קדמיום"
    ],
    [
      "Sr",
      "סטרונציום"
    ],
    [
      "Mo",
      "מוליבדן"
    ],
    [
      "Sb",
      "אנטימון",
      "סטיביום"
    ],
    [
      "Cs",
      "צזיום",
      "צסיום"
    ],
    [
      "Bi",
      "ביסמוט"
    ]
  ],
  "currencies": [
    [
      "דינר כוויתי",
      "כווית"
    ],
    [
      "טנגה",
      "קזחסטן"
    ]
  ],
  "languages": [
    [
      "אוזבקית",
      "אוזבקיסטן"
    ],
    [
      "בלארוסית",
      "בלארוס"
    ],
    [
      "אזרית",
      "אזרבייג׳ן"
    ]
  ],
  "units": [
    [
      "סימנס",
      "מוליכות חשמלית"
    ],
    [
      "הנרי",
      "השראות"
    ],
    [
      "פאראד",
      "קיבול חשמלי",
      "קיבול"
    ],
    [
      "טסלה",
      "שדה מגנטי"
    ],
    [
      "ובר",
      "שטף מגנטי"
    ],
    [
      "לוקס",
      "הארה",
      "עוצמת תאורה"
    ],
    [
      "קנדלה",
      "עוצמת אור"
    ],
    [
      "סיוורט",
      "מנת קרינה",
      "קרינה"
    ],
    [
      "גריי",
      "מנת קרינה",
      "קרינה"
    ],
    [
      "סטרדיאן",
      "זווית מרחבית"
    ],
    [
      "רדיאן",
      "זווית"
    ],
    [
      "קולון",
      "מטען חשמלי"
    ],
    [
      "קטל",
      "פעילות קטליטית"
    ],
    [
      "מטר לשנייה",
      "מהירות"
    ],
    [
      "מטר רבוע",
      "שטח"
    ],
    [
      "מטר מעוקב",
      "נפח"
    ],
    [
      "ג׳אול לשנייה",
      "הספק"
    ],
    [
      "ניוטון למטר רבוע",
      "לחץ"
    ],
    [
      "קולון לשנייה",
      "זרם"
    ],
    [
      "וולט לאמפר",
      "התנגדות"
    ],
    [
      "קילוגרם למטר מעוקב",
      "צפיפות"
    ],
    [
      "גרם לסנטימטר מעוקב",
      "צפיפות"
    ]
  ],
  "acronyms": [
    [
      "חמ״ל",
      "חדר מלחמה"
    ],
    [
      "רס״ר",
      "רב סמל ראשון"
    ],
    [
      "אכ״א",
      "אגף כוח אדם"
    ],
    [
      "מג״ד",
      "מפקד גדוד"
    ],
    [
      "מ״מ (בצבא)",
      "מפקד מחלקה"
    ],
    [
      "מ״פ",
      "מפקד פלוגה"
    ],
    [
      "חמ״ן",
      "חיל המודיעין"
    ],
    [
      "חי״ר",
      "חיל רגלים"
    ],
    [
      "אל״ם",
      "אלוף משנה"
    ],
    [
      "אמל״ח",
      "אמצעי לחימה"
    ],
    [
      "בה״ד",
      "בסיס הדרכה"
    ],
    [
      "קל״ב",
      "קרוב לבית"
    ],
    [
      "מלש״ב",
      "מיועד לשירות ביטחון"
    ],
    [
      "נגמ״ש",
      "נושא גייסות משוריין"
    ],
    [
      "תא״ל",
      "תת אלוף"
    ],
    [
      "סג״ם",
      "סגן משנה"
    ],
    [
      "פז״ם",
      "פרק זמן מינימלי"
    ],
    [
      "לוט״ר",
      "לוחמה בטרור"
    ],
    [
      "אב״כ",
      "אטומי ביולוגי כימי"
    ],
    [
      "חופ״ל",
      "חובש פלוגתי"
    ]
  ],
  "music-terms": [
    [
      "המרחק בין שני צלילים",
      "אינטרוול",
      "מרווח"
    ],
    [
      "רעיון מוזיקלי קצר שממנו מפתחים יצירה",
      "מוטיב"
    ],
    [
      "מרווח של שישה חצאי טון",
      "טריטון"
    ],
    [
      "מרווח של חמישה חצאי טון",
      "קווארטה"
    ],
    [
      "מרווח של שבעה חצאי טון",
      "קווינטה"
    ],
    [
      "מרווח של שנים עשר חצאי טון",
      "אוקטבה"
    ],
    [
      "סולם בעל חמישה צלילים",
      "סולם פנטטוני",
      "פנטטוני"
    ],
    [
      "סולם הכולל את כל שנים עשר חצאי הטון",
      "סולם כרומטי",
      "כרומטי"
    ],
    [
      "המוד שמתקבל בנגינת הקלידים הלבנים מרה עד רה",
      "דורי",
      "דוריאן"
    ],
    [
      "המוד שמתקבל בנגינת הקלידים הלבנים ממי עד מי",
      "פריגי",
      "פריגיאן"
    ],
    [
      "המוד שמתקבל בנגינת הקלידים הלבנים מפה עד פה",
      "לידי",
      "לידיאן"
    ],
    [
      "המוד שמתקבל בנגינת הקלידים הלבנים מסול עד סול",
      "מיקסולידי",
      "מיקסולידיאן"
    ],
    [
      "מערכת סולמות במוזיקה הערבית",
      "מקאם"
    ],
    [
      "שני חצאי טון יוצרים מרווח של",
      "טון שלם"
    ],
    [
      "נגינת צלילים מופרדים וקצרים",
      "סטקטו",
      "סטקאטו"
    ],
    [
      "נגינת צלילים מחוברים וחלקים",
      "לגטו",
      "לגאטו"
    ],
    [
      "פריטת מיתרי כלי קשת באצבעות במקום בקשת",
      "פיציקטו",
      "פיציקאטו"
    ],
    [
      "עיצוב ההפרדה והחיבור בין צלילים בביצוע",
      "ארטיקולציה"
    ],
    [
      "הוראה לנגן בשקט רב, מסומנת pp",
      "פיאניסימו"
    ],
    [
      "הוראה לנגן חזק מאוד, מסומנת ff",
      "פורטיסימו"
    ]
  ],
  "planets": [
    [
      "כוכב הלכת במקום 1 בסדר המרחק מהשמש",
      "חמה"
    ],
    [
      "כוכב הלכת במקום 2 בסדר המרחק מהשמש",
      "נוגה"
    ],
    [
      "כוכב הלכת במקום 3 בסדר המרחק מהשמש",
      "כדור הארץ"
    ],
    [
      "כוכב הלכת במקום 4 בסדר המרחק מהשמש",
      "מאדים"
    ],
    [
      "כוכב הלכת במקום 5 בסדר המרחק מהשמש",
      "צדק"
    ],
    [
      "כוכב הלכת במקום 6 בסדר המרחק מהשמש",
      "שבתאי"
    ],
    [
      "כוכב הלכת במקום 7 בסדר המרחק מהשמש",
      "אורנוס"
    ],
    [
      "כוכב הלכת במקום 8 בסדר המרחק מהשמש",
      "נפטון"
    ],
    [
      "כוכב הלכת שלפני נוגה כשמתרחקים מהשמש",
      "חמה"
    ],
    [
      "כוכב הלכת הבא אחרי חמה כשמתרחקים מהשמש",
      "נוגה"
    ],
    [
      "כוכב הלכת שלפני כדור הארץ כשמתרחקים מהשמש",
      "נוגה"
    ],
    [
      "כוכב הלכת הבא אחרי נוגה כשמתרחקים מהשמש",
      "כדור הארץ"
    ],
    [
      "כוכב הלכת שלפני מאדים כשמתרחקים מהשמש",
      "כדור הארץ"
    ],
    [
      "כוכב הלכת הבא אחרי כדור הארץ כשמתרחקים מהשמש",
      "מאדים"
    ],
    [
      "כוכב הלכת שלפני צדק כשמתרחקים מהשמש",
      "מאדים"
    ],
    [
      "כוכב הלכת הבא אחרי מאדים כשמתרחקים מהשמש",
      "צדק"
    ],
    [
      "כוכב הלכת שלפני שבתאי כשמתרחקים מהשמש",
      "צדק"
    ],
    [
      "כוכב הלכת הבא אחרי צדק כשמתרחקים מהשמש",
      "שבתאי"
    ],
    [
      "כוכב הלכת שלפני אורנוס כשמתרחקים מהשמש",
      "שבתאי"
    ],
    [
      "כוכב הלכת הבא אחרי שבתאי כשמתרחקים מהשמש",
      "אורנוס"
    ],
    [
      "כוכב הלכת שלפני נפטון כשמתרחקים מהשמש",
      "אורנוס"
    ],
    [
      "כוכב הלכת הבא אחרי אורנוס כשמתרחקים מהשמש",
      "נפטון"
    ],
    [
      "כוכב הלכת המדורג 1 בגודל במערכת השמש (מהגדול לקטן)",
      "צדק"
    ],
    [
      "כוכב הלכת המדורג 2 בגודל במערכת השמש (מהגדול לקטן)",
      "שבתאי"
    ],
    [
      "כוכב הלכת המדורג 3 בגודל במערכת השמש (מהגדול לקטן)",
      "אורנוס"
    ]
  ],
  "body-systems": [
    [
      "הצינור שמעביר שתן מכליה לשלפוחית",
      "שופכן"
    ],
    [
      "הצינור שמעביר שתן משלפוחית אל מחוץ לגוף",
      "שופכה"
    ],
    [
      "השק השרירי שבו נאגר השתן",
      "שלפוחית השתן",
      "שלפוחית"
    ],
    [
      "הצינור שמעביר אוויר אל הסימפונות",
      "קנה הנשימה"
    ],
    [
      "שני הענפים הראשיים שאליהם מתפצל קנה הנשימה",
      "סימפונות",
      "סמפונות"
    ],
    [
      "שקיקי האוויר שבהם מתרחש חילוף הגזים בריאות",
      "נאדיות הריאה",
      "נאדיות"
    ],
    [
      "האיבר שבו המזון נלעס ומתערבב עם הרוק",
      "פה"
    ],
    [
      "האיבר השרירי שמניע את המזון בפה ומסייע בבליעה",
      "לשון"
    ],
    [
      "הבלוטות שמפרישות את הנוזל המרטיב את המזון בפה",
      "בלוטות הרוק",
      "בלוטת רוק"
    ],
    [
      "הצינור שדרכו עובר מזון מהפה אל הוושט",
      "לוע"
    ],
    [
      "החלק הראשון של המעי הדק",
      "תריסריון"
    ],
    [
      "האיבר שבו נאגר מיץ המרה",
      "כיס המרה"
    ],
    [
      "חלק המעי שבו נספגים מים ונוצרת הצואה",
      "מעי גס",
      "המעי הגס"
    ],
    [
      "הקטע הצר והאטום המחובר למעי העיוור",
      "תוספתן"
    ],
    [
      "החלק האחרון של המעי הגס שבו הצואה נאגרת לפני יציאתה",
      "חלחולת"
    ],
    [
      "הפתח שדרכו הצואה יוצאת מהגוף",
      "פי הטבעת"
    ],
    [
      "האיבר שבו העובר מתפתח במהלך ההיריון",
      "רחם"
    ],
    [
      "הצינור שמוביל ביצית מהשחלה לרחם",
      "חצוצרה"
    ],
    [
      "החלק הצבעוני בעין שמקיף את האישון",
      "קשתית"
    ],
    [
      "הפתח במרכז הקשתית שדרכו נכנס אור לעין",
      "אישון"
    ],
    [
      "השכבה בעין שבה נמצאים התאים קולטי האור",
      "רשתית"
    ],
    [
      "החלק הקדמי השקוף של העין שמכסה את הקשתית",
      "קרנית"
    ],
    [
      "מבנה העצמות שמגן על המוח",
      "גולגולת"
    ],
    [
      "חלקיקי הדם שמשתתפים ביצירת קריש",
      "טסיות דם",
      "טסיות"
    ]
  ],
  "bible": [
    [
      "חמותה של רות",
      "נעמי"
    ],
    [
      "השופט שנלחם במדיינים עם שלוש מאות לוחמים",
      "גדעון"
    ],
    [
      "אחותם של משה ואהרן",
      "מרים"
    ],
    [
      "בנו של שאול שהיה חברו של דוד",
      "יהונתן",
      "יונתן"
    ],
    [
      "תלמידו של אליהו שביקש פי שניים ברוחו",
      "אלישע"
    ],
    [
      "אביהן של רחל ולאה",
      "לבן"
    ],
    [
      "אשתו של אחאב שהפיצה את עבודת הבעל",
      "איזבל"
    ],
    [
      "מלך ישראל שהיה בעלה של איזבל",
      "אחאב"
    ],
    [
      "השר שרצה להשמיד את היהודים במגילת אסתר",
      "המן"
    ],
    [
      "המלך שבחצרו פעלה אסתר",
      "אחשוורוש"
    ],
    [
      "האח שקין הרג",
      "הבל"
    ],
    [
      "האישה שחיה עם אדם בגן עדן",
      "חוה",
      "חווה"
    ],
    [
      "האב שיצא מארץ הולדתו לארץ כנען",
      "אברהם"
    ],
    [
      "אחיו התאום של עשיו",
      "יעקב"
    ],
    [
      "הכוהן שאצלו גדל שמואל בשילה",
      "עלי"
    ],
    [
      "המלך ששירת אצלו דניאל בגוב האריות",
      "דריוש"
    ],
    [
      "הנביא הירושלמי שעל שמו נקרא הספר הראשון בנביאים אחרונים",
      "ישעיהו"
    ],
    [
      "היהודי ששירת בארמון פרס ופעל לבניית חומות ירושלים",
      "נחמיה"
    ],
    [
      "בעלה של נעמי במגילת רות",
      "אלימלך"
    ]
  ],
  "sports-terms": [
    [
      "הצרחה",
      "שחמט"
    ],
    [
      "פט",
      "שחמט"
    ],
    [
      "הכאה דרך הילוכו",
      "שחמט"
    ],
    [
      "קידום רגלי למלכה",
      "שחמט"
    ],
    [
      "שח כפול",
      "שחמט"
    ],
    [
      "מזלג של פרש",
      "שחמט"
    ],
    [
      "זריקת עונשין לסל",
      "כדורסל"
    ],
    [
      "עבירת צעדים",
      "כדורסל"
    ],
    [
      "שעון 24 שניות להתקפה",
      "כדורסל"
    ],
    [
      "קשת שלוש הנקודות",
      "כדורסל"
    ],
    [
      "חסימת זריקה לסל",
      "כדורסל"
    ],
    [
      "רגל ציר",
      "כדורסל"
    ],
    [
      "משחקון הגשה",
      "טניס"
    ],
    [
      "שובר שוויון במערכה",
      "טניס"
    ],
    [
      "שוויון 40:40",
      "טניס"
    ],
    [
      "חבטת יעף",
      "טניס"
    ],
    [
      "חבטת הנחתה במחבט",
      "טניס"
    ],
    [
      "מערכה עם משחקונים",
      "טניס"
    ],
    [
      "קו בסיס במגרש מחבטים",
      "טניס"
    ],
    [
      "חבטת חצי יעף",
      "טניס"
    ]
  ],
  "animal-young": [
    [
      "אייל",
      "עופר"
    ],
    [
      "יעל נובי",
      "גדי"
    ],
    [
      "עז בר",
      "גדי"
    ],
    [
      "ראם לבן",
      "עגל"
    ],
    [
      "פרא",
      "עיר",
      "עייר"
    ],
    [
      "חגלה",
      "אפרוח"
    ],
    [
      "קורא",
      "אפרוח"
    ],
    [
      "תנין",
      "אבקוע"
    ],
    [
      "צב",
      "אבקוע"
    ],
    [
      "נחש",
      "אבקוע"
    ],
    [
      "לטאה",
      "אבקוע"
    ],
    [
      "שממית",
      "אבקוע"
    ],
    [
      "זיקית",
      "אבקוע"
    ],
    [
      "חגב",
      "נימפה"
    ],
    [
      "תיקן",
      "נימפה"
    ],
    [
      "גמל שלמה",
      "נימפה"
    ],
    [
      "זבוב",
      "רימה"
    ],
    [
      "חיפושית",
      "דרן"
    ],
    [
      "זאב",
      "גור"
    ],
    [
      "שועל",
      "גור",
      "שעלול"
    ],
    [
      "נמר",
      "גור"
    ],
    [
      "טיגריס",
      "גור"
    ],
    [
      "ברדלס",
      "גור"
    ],
    [
      "צבוע",
      "גור"
    ],
    [
      "תן",
      "גור"
    ],
    [
      "לוטרה",
      "גור"
    ],
    [
      "גירית",
      "גור"
    ],
    [
      "נמייה",
      "גור"
    ],
    [
      "אריה ים",
      "גור"
    ],
    [
      "כלב ים",
      "גור"
    ],
    [
      "פנתר",
      "גור"
    ]
  ],
  "inventions": [
    [
      "אוונג׳ליסטה טוריצ׳לי",
      "ברומטר"
    ],
    [
      "בלז פסקל — מכונת החישוב שפיתח",
      "מכונת חיבור",
      "מחשבון מכני"
    ],
    [
      "כריסטיאן הויגנס — שעון המבוסס על תנודה",
      "שעון מטוטלת"
    ],
    [
      "דני פפן — כלי הבישול שפיתח",
      "סיר לחץ"
    ],
    [
      "האחים מונגולפייה",
      "כדור פורח"
    ],
    [
      "אלי ויטני — המכשיר להפרדת זרעי כותנה",
      "מנפטה",
      "מנפטת כותנה"
    ],
    [
      "רנה לאנק — מכשיר ההאזנה שפיתח",
      "סטטוסקופ",
      "מסכת"
    ],
    [
      "לואי ברייל — מערכת הקריאה במישוש",
      "כתב ברייל",
      "ברייל"
    ],
    [
      "אדולף סקס",
      "סקסופון"
    ],
    [
      "דאגלס אנגלברט — אמצעי השליטה במחשב שפיתח",
      "עכבר מחשב",
      "עכבר"
    ],
    [
      "אדווין לנד — שיטת הצילום שפיתח",
      "צילום מיידי",
      "מצלמה מיידית",
      "פולארויד"
    ],
    [
      "צ׳סטר קרלסון — שיטת ההעתקה היבשה שפיתח",
      "זירוגרפיה",
      "צילום מסמכים"
    ],
    [
      "ג׳יימס נייסמית׳ — המשחק שהמציא",
      "כדורסל"
    ]
  ],
  "cities-israel": [
    [
      "המושבה במחוז המרכז שנוסדה ב־1878",
      "פתח תקווה",
      "פתח תקוה"
    ],
    [
      "העיר שבה נמצא בית ספר חביב",
      "ראשון לציון"
    ],
    [
      "העיר שבה נמצא מכון ויצמן למדע",
      "רחובות"
    ],
    [
      "עיר השרון הקרויה על שם נתן שטראוס",
      "נתניה"
    ],
    [
      "המושבה במחוז המרכז שנוסדה ב־1903",
      "כפר סבא"
    ],
    [
      "המושבה במחוז המרכז שנוסדה ב־1922",
      "רעננה"
    ],
    [
      "העיר שבין ראשון לציון לרחובות",
      "נס ציונה"
    ],
    [
      "העיר שנוסדה כמושבה ב־1907 והוכרזה כעיר ב־2021",
      "באר יעקב"
    ],
    [
      "העיר הצפונית שנקראה על שם שמונת מגיני תל חי",
      "קריית שמונה",
      "קרית שמונה"
    ],
    [
      "עיר במחוז תל אביב שנוסדה ב־1940",
      "חולון"
    ],
    [
      "העיר במחוז תל אביב שנוסדה ב־1926",
      "בת ים"
    ],
    [
      "עיר במחוז תל אביב שנוסדה ב־1922",
      "גבעתיים"
    ],
    [
      "עיר במחוז תל אביב שנוסדה ב־1923",
      "רמת השרון"
    ],
    [
      "העיר במחוז תל אביב שנוסדה ב־1939",
      "קריית אונו",
      "קרית אונו"
    ],
    [
      "עיר במחוז המרכז שנוסדה ב־1998",
      "אלעד"
    ],
    [
      "עיר במחוז חיפה שנוסדה ב־1982",
      "חריש"
    ],
    [
      "העיר בגליל שנוסדה ב־1964",
      "כרמיאל"
    ],
    [
      "עיר במחוז חיפה שנוסדה ב־1941",
      "קריית ים",
      "קרית ים"
    ],
    [
      "עיר במחוז הדרום שנוסדה ב־1972",
      "רהט"
    ],
    [
      "העיר במחוז המרכז שנוסדה ב־1996",
      "מודיעין מכבים רעות",
      "מודיעין"
    ],
    [
      "עיר במחוז הדרום שנוסדה ב־1953",
      "שדרות"
    ],
    [
      "עיר במחוז הדרום שנוסדה ב־1954",
      "קריית גת",
      "קרית גת"
    ],
    [
      "העיר במחוז הצפון שנוסדה ב־1935",
      "נהריה"
    ],
    [
      "עיר במחוז תל אביב שנוסדה ב־1921",
      "רמת גן"
    ]
  ],
  "geography": [
    [
      "האגם העמוק בעולם",
      "ימת באיקל",
      "באיקל",
      "אגם באיקל"
    ],
    [
      "האוקיינוס הקטן ביותר",
      "האוקיינוס הארקטי",
      "אוקיינוס הקרח הצפוני"
    ],
    [
      "ההר הגבוה ביותר באמריקה הדרומית",
      "אקונקגווה"
    ],
    [
      "ההר הגבוה ביותר באמריקה הצפונית",
      "מקינלי",
      "דנאלי",
      "הר מקינלי",
      "הר דנאלי"
    ],
    [
      "ההר הגבוה באנטארקטיקה",
      "הר וינסון",
      "וינסון",
      "מסיב וינסון"
    ],
    [
      "ההר הגבוה באירופה, ברכס הקווקז",
      "אלברוס",
      "הר אלברוס"
    ],
    [
      "הנהר הארוך ביותר באסיה",
      "יאנגצה"
    ],
    [
      "השקע האוקייני העמוק בעולם",
      "שקע מריאנה",
      "מריאנה"
    ],
    [
      "חצי האי הגדול בעולם",
      "חצי האי ערב",
      "ערב"
    ],
    [
      "המפרץ הגדול בעולם, בצפון מזרח האוקיינוס ההודי",
      "מפרץ בנגל"
    ],
    [
      "האגם הטרופי הגדול בעולם",
      "אגם ויקטוריה",
      "ויקטוריה"
    ],
    [
      "האגם העמוק ביותר באפריקה",
      "אגם טנגניקה",
      "טנגניקה"
    ],
    [
      "המצר שבין סיביר לאלסקה",
      "מצר ברינג",
      "מיצר ברינג"
    ],
    [
      "המצר שמחבר בין הים התיכון לאוקיינוס האטלנטי",
      "מצר גיברלטר",
      "מיצר גיברלטר"
    ],
    [
      "האגם הגבוה שבגבול פרו ובוליביה",
      "טיטיקקה",
      "אגם טיטיקקה"
    ],
    [
      "המדבר שבצפון סין ובדרום מונגוליה",
      "גובי",
      "מדבר גובי"
    ],
    [
      "קבוצת האיים הגעשיים באוקיינוס השקט שהיא מדינה בארצות הברית",
      "הוואי",
      "איי הוואי"
    ],
    [
      "הנהר שעל גדותיו וינה, בודפשט ובלגרד",
      "דנובה"
    ],
    [
      "הים שבין חצי האי ערב למזרח אפריקה",
      "ים סוף",
      "הים האדום"
    ],
    [
      "הים המליח בצפון אירופה שבין שוודיה לפינלנד",
      "הים הבלטי"
    ],
    [
      "המפלים המפורסמים בגבול ארצות הברית וקנדה",
      "מפלי הניאגרה",
      "ניאגרה"
    ],
    [
      "המדבר לאורך חופי נמיביה באפריקה",
      "נמיב",
      "מדבר נמיב"
    ]
  ]
};
const PHOTO_LINKS = {
  mammals: ['photo-animals'], birds: ['photo-birds'], sealife: ['photo-sea'],
  insects: ['photo-bugs','photo-reptiles'], fruits: ['photo-fruits'],
  vegetables: ['photo-vegetables'], dishes: ['photo-food'], desserts: ['photo-desserts'],
  drinks: ['photo-drinks'], instruments: ['photo-instruments'], body: ['photo-body'],
  flowers: ['photo-flowers'], hands: ['photo-hands'], art: ['photo-art'],
  furniture: ['photo-furniture'], games: ['photo-games'], holidays: ['photo-celebrations'],
  jobs: ['photo-jobs'], kitchen: ['photo-kitchen'], medical: ['photo-medical'],
  money: ['photo-money'], tools: ['photo-tools'], nature: ['photo-nature'],
  travel: ['photo-travel'], tech: ['photo-technology'], clothing: ['photo-clothing'],
  school: ['photo-school'], buildings: ['photo-buildings'], transport: ['photo-vehicles'],
  sports: ['photo-sport'], space: ['photo-space'],
};
const EXCLUDED = { body: new Set(['רגל תותבת']) };

/** Never let a broad answer/alias become a false positive for a new subject. */
function enrichPhotos(category, photos, findCollisions) {
  for(const [text,answer,...aliases] of EXTRA[category.id] || []) {
    const existing=category.items.find(i=>i.answer===answer);
    const item={text,answer,aliases:[...new Set([...(existing?.aliases||[]),...aliases])],difficulty:3};
    if(!findCollisions({...category,items:[...category.items,item]}).length) category.items.push(item);
  }
  for (const id of PHOTO_LINKS[category.id] || []) {
    const pool = photos.find(c => c.id === id);
    for (const item of pool?.items || []) {
      if (EXCLUDED[category.id]?.has(item.answer)) continue;
      if (category.items.some(i => i.answer === item.answer || i.image === item.image)) continue;
      const candidate = {...item};
      delete candidate.reviewed; delete candidate.subject;
      const trial = {...category, items: [...category.items, candidate]};
      if (!findCollisions(trial).length) category.items.push(candidate);
    }
  }
  return category;
}
return { enrichPhotos };

})();
const { expandVariants } = (() => {

const { svg, textSvg, escapeXml } = require('./svg');
const path = require('path');
const fs = require('fs');
// Explicitly approved: more clues in finite categories may reuse answers.
// These are not additional months, letters, signs, countries, or colors.
const FINITE_VISUAL = new Set(['colors','shapes','hands','weather',
  'map-europe','map-asia','map-americas','flags-europe','flags-asia',
  'flags-africa','flags-americas']);
const ORDERS = {
  'hebrew-months': ['תשרי','חשוון','כסלו','טבת','שבט','אדר','ניסן','אייר','סיוון','תמוז','אב','אלול'],
  zodiac: ['טלה','שור','תאומים','סרטן','אריה','בתולה','מאזניים','עקרב','קשת','גדי','דלי','דגים'],
  greek: ['אלפא','בטא','גמא','דלתא','אפסילון','זטא','אטא','תטא','יוטא','קאפא','למדא','מיו','נו','קסי','אומיקרון','פאי','רו','סיגמא','טאו','אפסילון יווני','פי','חי','פסי','אומגה'],
  'hebrew-letters': ['אלף','בית','גימל','דלת','הא','וו','זין','חית','טית','יוד','כף','למד','מם','נון','סמך','עין','פא','צדי','קוף','ריש','שין','תו'],
};
function addUnique(c,item) {
  if (!c.items.some(i => (i.image && i.image === item.image) || (i.text && i.text === item.text))) c.items.push(item);
}
function sequence(c) {
  const order=ORDERS[c.id]; if(!order || c.items.length>=50) return c;
  const original = new Map(c.items.map(i=>[i.answer,i]));
  if(c.id==='greek') {
    const lower='αβγδεζηθικλμνξοπρστυφχψω';
    const upper='ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
    for(let j=0;j<lower.length;j++) {
      const item=c.items.find(i=>i.text===lower[j]);
      if(item) addUnique(c,{text:upper[j],answer:item.answer,aliases:item.aliases||[],difficulty:3});
    }
  }

  const noun=c.id==='hebrew-months'?'חודש':c.id==='zodiac'?'מזל':'אות';
  const cycle=c.id==='hebrew-months'||c.id==='zodiac';
  const context=c.id==='hebrew-months'?'בסדר החודשים בשנה רגילה מתשרי':c.id==='zodiac'?'בסדר המזלות מטלה':c.id==='greek'?'בסדר האלפבית היווני':'בסדר האלפבית העברי';
  for(let step=1;step<=3 && c.items.length<50;step++) {
    for(let i=0;i<order.length && c.items.length<50;i++) {
      const target=original.get(order[i]); if(!target) throw Error('Unknown finite answer '+order[i]);
      for(const direction of [-1,1]) {
        const anchor=i+direction*step;
        if(!cycle && (anchor<0||anchor>=order.length)) continue;
        const name=order[(anchor+order.length)%order.length];
        const action=direction===-1?'אחרי':'לפני';
        const distance=step===1?'':step===2?'שני מקומות ':'שלושה מקומות ';
        const text=`${context}: ${noun==='אות'?'איזו אות נמצאת':`איזה ${noun} נמצא`} ${distance}${action} ${name}?`;
        addUnique(c,{text,answer:target.answer,aliases:target.aliases||[],...(target.typedAliases?{typedAliases:target.typedAliases}:{}),difficulty:Math.min(5,step+2)});
        if(c.items.length>=50) break;
      }
    }
  }
  return c;
}
function visual(c, {media,write}) {
  if(!FINITE_VISUAL.has(c.id) || c.items.length>=50) return c;
  const originals=[...c.items].filter(i=>i.image?.startsWith('/media/'));
  // A choice card asks the player to name only the arrow-marked image.
  // Repeating a member is intentional; a second member creates a new comparison.
  for(let round=1;c.items.length<50 && round<4;round++) for(let i=0;i<originals.length&&c.items.length<50;i++) {
    const target=originals[i], other=originals[(i+round)%originals.length];
    if(target.answer===other.answer) continue;
    const left=(i+round)%2===0;
    const title='מה מסומן בחץ?';
    const embed=(item,x)=> {
      const raw=fs.readFileSync(path.join(media,item.image.slice('/media/'.length)),'utf8');
      return `<image x="${x}" y="90" width="280" height="230" href="data:image/svg+xml;base64,${Buffer.from(raw).toString('base64')}"/>`;
    };
    const center=left?150:450;
    const body=`<text x="300" y="42" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#eef2ff" direction="rtl">${escapeXml(title)}</text>`+
      embed(left?target:other,10)+embed(left?other:target,310)+
      `<path d="M${center},365 V330 M${center-12},342 L${center},327 L${center+12},342" fill="none" stroke="#ffcc33" stroke-width="7" stroke-linecap="round"/>`;
    const slug=`compare-${round}-${i}.svg`;
    write(path.join(media,c.id,slug),svg(body,{bg:'#101528'}));
    addUnique(c,{image:`/media/${c.id}/${slug}`,answer:target.answer,aliases:target.aliases||[],difficulty:Math.min(5,(target.difficulty||2)+1)});
  }
  return c;
}
function capitals(c, options) {
  if (!c.id.startsWith('capitals-') || c.items.length >= 50) return c;
  const original=[...c.items];
  for (let i=0;i<original.length && c.items.length<50;i++) {
    const target=original[i], other=original[(i+1)%original.length];
    const left=i%2===0, center=left?150:450;
    const label=(text,x)=>`<text x="${x}" y="205" text-anchor="middle" font-size="30" fill="#eef2ff" direction="rtl" font-family="sans-serif">${escapeXml(text)}</text>`;
    const body='<text x="300" y="45" text-anchor="middle" font-family="sans-serif" font-size="25" fill="#eef2ff" direction="rtl">באיזו מדינה הבירה המסומנת בחץ?</text>'+
      label(left?target.text:other.text,150)+label(left?other.text:target.text,450)+
      `<path d="M${center},310 V250 M${center-12},264 L${center},248 L${center+12},264" fill="none" stroke="#ffcc33" stroke-width="7"/>`;
    const slug=`capital-compare-${i}.svg`;
    options.write(path.join(options.media,c.id,slug),svg(body,{bg:'#101528'}));
    addUnique(c,{image:`/media/${c.id}/${slug}`,answer:target.answer,aliases:target.aliases||[],difficulty:Math.min(5,(target.difficulty||2)+1)});
  }
  return c;
}
function expandVariants(c,options) {return visual(capitals(sequence(c),options),options);}
return { expandVariants };

})();
// Licensed, pixel-reviewed additions. Existing pools are preserved exactly.
const PHOTO_ADDITIONS = {"photo-vehicles": [{"subject": "Kayak", "answer": "קיאק", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/34/Mohammad_Abubakar_Durrani_with_Kayak_paddlers_Pakistan_in_snow_training_2012_%28Hanna_Lake%29.jpg/960px-Mohammad_Abubakar_Durrani_with_Kayak_paddlers_Pakistan_in_snow_training_2012_%28Hanna_Lake%29.jpg", "source": "https://commons.wikimedia.org/wiki/File:Mohammad_Abubakar_Durrani_with_Kayak_paddlers_Pakistan_in_snow_training_2012_(Hanna_Lake).jpg", "license": "CC BY-SA 4.0", "artist": "Simon KB", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Simon KB · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Kayak", "difficulty": 3, "reviewed": true}, {"subject": "Delivery truck", "answer": "משאית משלוחים", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Coca-Cola_delivery_truck.jpg/960px-Coca-Cola_delivery_truck.jpg", "source": "https://commons.wikimedia.org/wiki/File:Coca-Cola_delivery_truck.jpg", "license": "CC BY 2.0", "artist": "Connor Williams", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "credit": "Connor Williams · CC BY 2.0", "subjectSource": "https://en.wikipedia.org/wiki/Delivery_%28commerce%29", "difficulty": 3, "reviewed": true}, {"subject": "Pallet jack", "answer": "עגלת משטחים", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Pompwagen.jpg/960px-Pompwagen.jpg", "source": "https://commons.wikimedia.org/wiki/File:Pompwagen.jpg", "license": "CC BY 3.0", "artist": "Sterkebak", "licenseUrl": "https://creativecommons.org/licenses/by/3.0", "credit": "Sterkebak · CC BY 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Pallet_jack", "difficulty": 4, "reviewed": true}, {"subject": "Trolleybus", "answer": "טרוליבוס", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/S5A-0062_at_Wusong_Rd%2C_Tanggu_Rd_%2820251029065137%29.jpg/500px-S5A-0062_at_Wusong_Rd%2C_Tanggu_Rd_%2820251029065137%29.jpg", "source": "https://commons.wikimedia.org/wiki/File:S5A-0062_at_Wusong_Rd,_Tanggu_Rd_(20251029065137).jpg", "license": "CC BY-SA 4.0", "artist": "N509FZ", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "N509FZ · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Trolleybus", "difficulty": 2, "reviewed": true}, {"subject": "Tram", "answer": "חשמלית", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Muzeum_MHD%2C_tramvaje_T3_8084_a_6149%2C_zep%C5%99edu.jpg/500px-Muzeum_MHD%2C_tramvaje_T3_8084_a_6149%2C_zep%C5%99edu.jpg", "source": "https://commons.wikimedia.org/wiki/File:Muzeum_MHD,_tramvaje_T3_8084_a_6149,_zep%C5%99edu.jpg", "license": "CC BY-SA 3.0", "artist": "ŠJů  ( cs:ŠJů )", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "ŠJů  ( cs:ŠJů ) · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Tram", "difficulty": 2, "reviewed": true}, {"subject": "Snowplow", "answer": "מפלסת שלג", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/TowPLow_front_view2.JPG/500px-TowPLow_front_view2.JPG", "source": "https://commons.wikimedia.org/wiki/File:TowPLow_front_view2.JPG", "license": "CC BY-SA 3.0", "artist": "SnowKing1", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "credit": "SnowKing1 · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Snowplow", "difficulty": 2, "reviewed": true}, {"subject": "Garbage truck", "answer": "משאית אשפה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/LA-City-Sanitation-trash-truck-1.jpg/500px-LA-City-Sanitation-trash-truck-1.jpg", "source": "https://commons.wikimedia.org/wiki/File:LA-City-Sanitation-trash-truck-1.jpg", "license": "CC BY-SA 4.0", "artist": "Bdonjc", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Bdonjc · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Garbage_truck", "difficulty": 2, "reviewed": true}, {"subject": "Hovercraft", "answer": "רחפת", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Formel1_hovercraft.jpg/500px-Formel1_hovercraft.jpg", "source": "https://commons.wikimedia.org/wiki/File:Formel1_hovercraft.jpg", "license": "CC BY-SA 3.0", "artist": "Thomas Philipp", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "Thomas Philipp · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Hovercraft", "difficulty": 2, "reviewed": true}, {"subject": "Forklift", "answer": "מלגזה", "aliases": ["מלגזה ניידת"], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/MOFFETT_truck_mounted_forklift.jpg/500px-MOFFETT_truck_mounted_forklift.jpg", "source": "https://commons.wikimedia.org/wiki/File:MOFFETT_truck_mounted_forklift.jpg", "license": "CC BY 4.0", "artist": "Photographer:  Mosbatho", "licenseUrl": "https://creativecommons.org/licenses/by/4.0", "credit": "Photographer:  Mosbatho · CC BY 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Forklift", "difficulty": 2, "reviewed": true}, {"subject": "Auto rickshaw", "answer": "טוקטוק", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Bajaj_auto-rickshaw_in_Sri_Lanka.jpg/500px-Bajaj_auto-rickshaw_in_Sri_Lanka.jpg", "source": "https://commons.wikimedia.org/wiki/File:Bajaj_auto-rickshaw_in_Sri_Lanka.jpg", "license": "CC BY-SA 2.0", "artist": "calflier001 , cropped by uploader  Mr.choppers", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "credit": "calflier001 , cropped by uploader  Mr.choppers · CC BY-SA 2.0", "subjectSource": "https://en.wikipedia.org/wiki/Auto_rickshaw", "difficulty": 2, "reviewed": true}], "photo-vegetables": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/960px-Tomato_je.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "עגבנייה", "aliases": [], "difficulty": 4, "credit": "Softeis · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Tomato_je.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Softeis", "subjectSource": "https://en.wikipedia.org/wiki/Tomato", "subjectTitle": "Tomato", "imageDescription": "Best Of Cheese Foods!\n \n  Tomato Burger \n Tomato Pizza \n Tomato Lasagna", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Vegetable-Carrot-Bundle-wStalks.jpg/960px-Vegetable-Carrot-Bundle-wStalks.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "גזר", "aliases": [], "difficulty": 4, "credit": "Evan-Amos · Public domain", "source": "https://commons.wikimedia.org/wiki/File:Vegetable-Carrot-Bundle-wStalks.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Evan-Amos", "subjectSource": "https://en.wikipedia.org/wiki/Carrot", "subjectTitle": "Carrot", "imageDescription": "A bundle of carrots with their stalks still attached. Bought from a farmers market in Brooklyn, from an independent farm.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/960px-Solanum_melongena_24_08_2012_%281%29.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חציל", "aliases": [], "difficulty": 4, "credit": "Joydeep · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Solanum_melongena_24_08_2012_(1).JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Joydeep", "subjectSource": "https://en.wikipedia.org/wiki/Eggplant", "subjectTitle": "Eggplant", "imageDescription": "Solanum melongena  fruit in plant.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/3/37/Spinacia_oleracea_Spinazie_bloeiend.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "תרד", "aliases": [], "difficulty": 4, "credit": "Rasbak · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Spinacia_oleracea_Spinazie_bloeiend.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Rasbak", "subjectSource": "https://en.wikipedia.org/wiki/Spinach", "subjectTitle": "Spinach", "imageDescription": "Spinacia oleracea flowering", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0d/Celery_1.jpg/960px-Celery_1.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סלרי", "aliases": [], "difficulty": 4, "credit": "Lombroso · Public domain", "source": "https://commons.wikimedia.org/wiki/File:Celery_1.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Lombroso", "subjectSource": "https://en.wikipedia.org/wiki/Celery", "subjectTitle": "Celery", "imageDescription": "Celery", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Leek_on_white_background_-_0947.jpg/960px-Leek_on_white_background_-_0947.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כרישה", "aliases": [], "difficulty": 4, "credit": "Amada44 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Leek_on_white_background_-_0947.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Amada44", "subjectSource": "https://en.wikipedia.org/wiki/Leek", "subjectTitle": "Leek", "imageDescription": "Leek on white background", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Ipomoea_batatas_006.JPG/960px-Ipomoea_batatas_006.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "בטטה", "aliases": [], "difficulty": 4, "credit": "Llez · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Ipomoea_batatas_006.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Llez", "subjectSource": "https://en.wikipedia.org/wiki/Sweet_potato", "subjectTitle": "Sweet potato", "imageDescription": "Ipomoea batatas , Convolvulaceae, Sweet Potato, storage roots; Karlsruhe, Germany. The plant is used in homeopathy as remedy: Ipomoea batatas (Ipom-b.)", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Brassica_oleracea_var._gongylodes_%28kohlrabi%29.jpg/960px-Brassica_oleracea_var._gongylodes_%28kohlrabi%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קולרבי", "aliases": [], "difficulty": 4, "credit": "Unknown · CC0 · https://www.rawpixel.com/image/6037170/photo-image-public-domain-plant-green", "source": "https://commons.wikimedia.org/wiki/File:Brassica_oleracea_var._gongylodes_(kohlrabi).jpg", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "artist": "Unknown", "subjectSource": "https://en.wikipedia.org/wiki/Kohlrabi", "subjectTitle": "Kohlrabi", "imageDescription": "Brassica oleracea var. gongylodes (kohlrabi)", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Romanesco_broccoli_%28Brassica_oleracea%29.jpg/960px-Romanesco_broccoli_%28Brassica_oleracea%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כרובית רומנסקו", "aliases": [], "difficulty": 4, "credit": "Ivar Leidus · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Romanesco_broccoli_(Brassica_oleracea).jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Ivar Leidus", "subjectSource": "https://en.wikipedia.org/wiki/Romanesco_broccoli", "subjectTitle": "Romanesco broccoli", "imageDescription": "Romanesco broccoli ( Brassica oleracea )", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/Yam_at_monday_market_kaduna_state_01.jpg/960px-Yam_at_monday_market_kaduna_state_01.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "יאם", "aliases": [], "difficulty": 4, "credit": "Dorcas Atule · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Yam_at_monday_market_kaduna_state_01.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Dorcas Atule", "subjectSource": "https://en.wikipedia.org/wiki/Yam_(vegetable)", "subjectTitle": "Yam (vegetable)", "imageDescription": "This is an image with the theme \" Farm to Plate \" from:", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Broccolini.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "ברוקוליני", "aliases": [], "difficulty": 4, "credit": "User  Agriffin  on  en.wikipedia · CC BY 1.0 · Taken by Agriffin .", "source": "https://commons.wikimedia.org/wiki/File:Broccolini.jpg", "license": "CC BY 1.0", "licenseUrl": "https://creativecommons.org/licenses/by/1.0", "artist": "User  Agriffin  on  en.wikipedia", "subjectSource": "https://en.wikipedia.org/wiki/Broccolini", "subjectTitle": "Broccolini", "imageDescription": "Broccolini (Brassica oleracea var. Alboglabra X Brassica oleracea var. Italica)", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Sugar_Snap_Pea.JPG/960px-Sugar_Snap_Pea.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "אפונת סוכר", "aliases": ["סנאפ פיז"], "difficulty": 4, "credit": "Brianga · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Sugar_Snap_Pea.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Brianga", "subjectSource": "https://en.wikipedia.org/wiki/Snap_pea", "subjectTitle": "Snap pea", "imageDescription": "Sugar Snap Pea", "reviewed": true}, {"subject": "Asparagus", "answer": "אספרגוס", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Green_Asparagus_New_York_11_May_2006.jpg/500px-Green_Asparagus_New_York_11_May_2006.jpg", "source": "https://commons.wikimedia.org/wiki/File:Green_Asparagus_New_York_11_May_2006.jpg", "license": "Public domain", "artist": "RyanFreisling", "licenseUrl": "", "credit": "RyanFreisling · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Asparagus", "difficulty": 2, "reviewed": true}, {"subject": "Ginger", "answer": "ג'ינג'ר", "aliases": ["זנגביל", "גינגר", "גינגר טרי"], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Ginger_on_Dark_Board.jpg/500px-Ginger_on_Dark_Board.jpg", "source": "https://commons.wikimedia.org/wiki/File:Ginger_on_Dark_Board.jpg", "license": "CC BY-SA 4.0", "artist": "Kjokkenutstyr", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Kjokkenutstyr · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Ginger", "difficulty": 2, "reviewed": true}, {"subject": "Coriander", "answer": "כוסברה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/A_scene_of_Coriander_leaves.JPG/500px-A_scene_of_Coriander_leaves.JPG", "source": "https://commons.wikimedia.org/wiki/File:A_scene_of_Coriander_leaves.JPG", "license": "CC BY-SA 3.0", "artist": "Thamizhpparithi Maari", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "Thamizhpparithi Maari · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Coriander", "difficulty": 2, "reviewed": true}, {"subject": "Parsley", "answer": "פטרוזיליה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/Parsley100.jpg/500px-Parsley100.jpg", "source": "https://commons.wikimedia.org/wiki/File:Parsley100.jpg", "license": "CC BY-SA 3.0", "artist": "Tharish", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "Tharish · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Parsley", "difficulty": 2, "reviewed": true}, {"subject": "Dill", "answer": "שמיר", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Anethum_graveolens_001.JPG/500px-Anethum_graveolens_001.JPG", "source": "https://commons.wikimedia.org/wiki/File:Anethum_graveolens_001.JPG", "license": "CC BY-SA 3.0", "artist": "H. Zell", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "H. Zell · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Dill", "difficulty": 2, "reviewed": true}, {"subject": "Green bean", "answer": "שעועית ירוקה", "aliases": ["שעועית"], "image": "https://upload.wikimedia.org/wikipedia/commons/9/9e/A_green_bean.jpg", "source": "https://commons.wikimedia.org/wiki/File:A_green_bean.jpg", "license": "CC BY 2.0", "artist": "wanko  from Japan", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "credit": "wanko  from Japan · CC BY 2.0", "subjectSource": "https://en.wikipedia.org/wiki/Green_bean", "difficulty": 2, "reviewed": true}], "photo-jobs": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/US_Navy_040902-N-7683J-003_Electrician%27s_Mate_3rd_Class_Tayo_Gbadebo_from_Lagos%2C_Nigeria%2C_rewires_the_motor_from_an_Aqueous_Film_Forming_Foam_%28AFFF%29_Sprinkler_System%27s_pump.jpg/960px-thumbnail.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חשמלאי", "aliases": [], "difficulty": 4, "credit": "U.S. Navy photo by Photographer’s Mate 2nd Class Jason Jacobowitz · Public domain · This image was released by the United States Navy with the ID 040902-N-7683J-003 (next) . This tag does not indicate the copyright status of the attached work. A normal copyright tag is still required. See Commons:Licensing . العربية ∙ বাংলা ∙ Bahasa Indonesia ∙ Bahaso Jambi ∙ Deutsch ∙ Deutsch (Sie-Form) ∙ English ∙ español ∙ euskara ∙ فارسی ∙ français ∙ italiano ∙ 日本語 ∙ 한국어 ∙ македонски ∙ മലയാളം ∙ Plattdüütsch ∙ Nederlands ∙ polski ∙ پښتو ∙ português ∙ русский ∙ slovenščina ∙ svenska ∙ Türkçe ∙ українська ∙ 简体中文 ∙ 繁體中文 ∙ +/−", "source": "https://commons.wikimedia.org/wiki/File:US_Navy_040902-N-7683J-003_Electrician%27s_Mate_3rd_Class_Tayo_Gbadebo_from_Lagos,_Nigeria,_rewires_the_motor_from_an_Aqueous_Film_Forming_Foam_(AFFF)_Sprinkler_System%27s_pump.jpg", "license": "Public domain", "licenseUrl": "", "artist": "U.S. Navy photo by Photographer’s Mate 2nd Class Jason Jacobowitz", "subjectSource": "https://en.wikipedia.org/wiki/Electrician", "subjectTitle": "Electrician", "imageDescription": "Arabian Gulf (Sept. 2, 2004) - Electrician's Mate 3rd Class Tayo Gbadebo from Lagos, Nigeria, rewires the motor from an Aqueous Film Forming Foam (AFFF) Sprinkler System’s pump during a routine maintenance in the Machine Shop aboard the conventionally powered aircraft carrier USS John F Kennedy (CV 67). The machine shop troubleshoots equipment, makes mechanical and electrical repairs  throughout the ship. The Kennedy and Carrier Air Wing Seventeen (CVW-17) are operating in the 5th fleet area of responsibility (AOR) in support of Operation Iraqi Freedom (OIF). Units in the Kennedy Strike Group are working closely with Multi-National Corps-Iraq and Iraqi forces to bring stability to the sovereign government of Iraq. U.S. Navy photo by Photographer’s Mate 2nd Class Jason Jacobowitz (RELEASED)", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Wiki_Loves_Mett_P1020898.JPG/960px-Wiki_Loves_Mett_P1020898.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קצב", "aliases": [], "difficulty": 4, "credit": "Fridolin Freudenfett · CC BY 3.0 de", "source": "https://commons.wikimedia.org/wiki/File:Wiki_Loves_Mett_P1020898.JPG", "license": "CC BY 3.0 de", "licenseUrl": "https://creativecommons.org/licenses/by/3.0/de/deed.en", "artist": "Fridolin Freudenfett", "subjectSource": "https://en.wikipedia.org/wiki/Butcher", "subjectTitle": "Butcher", "imageDescription": "Wiki Loves Mett: Trennen der Rippen zu Kammstück und Dicker Rippe", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/PikePlaceMarket2006.jpg/960px-PikePlaceMarket2006.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מוכר דגים", "aliases": [], "difficulty": 4, "credit": "Epukas · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:PikePlaceMarket2006.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Epukas", "subjectSource": "https://en.wikipedia.org/wiki/Fishmonger", "subjectTitle": "Fishmonger", "imageDescription": "Pure Food Fish, Pike Place Market, Seattle, Washington, U.S.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/c/cd/Corsaire_-Le_Jardin_Anime_-Pierina_Legnani_-Olga_Preobrajenska_-1899.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "רקדן בלט", "aliases": [], "difficulty": 4, "credit": "Unknown photographer of the Imperial Mariinsky Theatre. St. Petersburg, Russian Empire. · Public domain · Scanned from the theatre program for the ballet Le Corsaire . Bayerisches Staatsballett (Bavarian State Ballet). Munich, Bavaria. 2007.", "source": "https://commons.wikimedia.org/wiki/File:Corsaire_-Le_Jardin_Anime_-Pierina_Legnani_-Olga_Preobrajenska_-1899.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Unknown photographer of the Imperial Mariinsky Theatre. St. Petersburg, Russian Empire.", "subjectSource": "https://en.wikipedia.org/wiki/Ballet_dancer", "subjectTitle": "Ballet dancer", "imageDescription": "Photographic postcard of the ballerinas Pierina Legnani as Medora (right) and Olga Preobrajenskaya as Gulnare (left) in the scene Le jardin animé from the ballet Le Corsaire.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/3/31/Bundesarchiv_Bild_183-S74736%2C_Glaser_bei_der_Arbeit.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "זגג", "aliases": [], "difficulty": 4, "credit": "Heinscher · CC BY-SA 3.0 de · This image was provided to Wikimedia Commons by the German Federal Archive (Deutsches Bundesarchiv) as part of a cooperation project . The German Federal Archive guarantees an authentic representation only using the originals (negative and/or positive), resp. the digitalization of the originals as provided by the Digital Image Archive .", "source": "https://commons.wikimedia.org/wiki/File:Bundesarchiv_Bild_183-S74736,_Glaser_bei_der_Arbeit.jpg", "license": "CC BY-SA 3.0 de", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en", "artist": "Heinscher", "subjectSource": "https://en.wikipedia.org/wiki/Glazier", "subjectTitle": "Glazier", "imageDescription": "For documentary purposes the German Federal Archive often retained the  original image captions , which may be  erroneous, biased, obsolete or politically extreme .           Glaser bei der Arbeit \n Glaser bei der Arbeit\nAufn. Illus-Heinscher Aug. 46\n \n282-46", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Shoe-polish-guy-Bombay.jpg/960px-Shoe-polish-guy-Bombay.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מצחצח נעליים", "aliases": [], "difficulty": 4, "credit": "No machine-readable author provided.  Nichalp  assumed (based on copyright claims). · CC BY-SA 3.0 · No machine-readable source provided. Own work assumed (based on copyright claims).", "source": "https://commons.wikimedia.org/wiki/File:Shoe-polish-guy-Bombay.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "No machine-readable author provided.  Nichalp  assumed (based on copyright claims).", "subjectSource": "https://en.wikipedia.org/wiki/Shoeshiner", "subjectTitle": "Shoeshiner", "imageDescription": "A shoe shine guy on the  Sion  railway station in  Mumbai ,  India \n \nPicture taken by me,  Nichalp  on 9-Nov-2005", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Florence_Tattoo_Convention_%285158061891%29.jpg/960px-Florence_Tattoo_Convention_%285158061891%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מקעקע", "aliases": [], "difficulty": 4, "credit": "jimmyweee · CC BY 2.0 · Florence Tattoo Convention", "source": "https://commons.wikimedia.org/wiki/File:Florence_Tattoo_Convention_(5158061891).jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "jimmyweee", "subjectSource": "https://en.wikipedia.org/wiki/Tattoo_artist", "subjectTitle": "Tattoo artist", "imageDescription": "Florence Tattoo Convention", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Nikolai_Zykov_with_hand_puppets%2C_Russia.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "בובנאי", "aliases": [], "difficulty": 4, "credit": "Nadya Dubinina · CC BY-SA 4.0 · https://www.zykov.ru/photopuppeteer.jpg", "source": "https://commons.wikimedia.org/wiki/File:Nikolai_Zykov_with_hand_puppets,_Russia.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Nadya Dubinina", "subjectSource": "https://en.wikipedia.org/wiki/Puppeteer", "subjectTitle": "Puppeteer", "imageDescription": "Nikolai Zykov with hand puppets, Russia. Nikolai Zykov - Soviet and Russian actor, director, artist, designer, puppet-maker, master puppeteer, author of over 20 puppet performances. Nikolai Zykov has created and has made over 80 puppet vignettes with participation of marionettes, hand, rod, giant, radio-controlled and experimental puppets. Nikolai Zykov has performed in 35 countries around the world. More Information  www.zykov.ru", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Afghan_circus.jpg/960px-Afghan_circus.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "להטוטן", "aliases": [], "difficulty": 4, "credit": "Mobile Mini Circus for Children · CC BY-SA 4.0 · https://www.facebook.com/AfghanCircus/photos/1611460555621929", "source": "https://commons.wikimedia.org/wiki/File:Afghan_circus.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Mobile Mini Circus for Children", "subjectSource": "https://en.wikipedia.org/wiki/Juggling", "subjectTitle": "Juggling", "imageDescription": "Children performing juggling supported by the Afghan Mobile Mini Circus for Children NGO", "reviewed": true}, {"subject": "Barista", "answer": "בריסטה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Gwilym_Davies.jpg/500px-Gwilym_Davies.jpg", "source": "https://commons.wikimedia.org/wiki/File:Gwilym_Davies.jpg", "license": "CC BY 3.0", "artist": "Liz Clayton", "licenseUrl": "https://creativecommons.org/licenses/by/3.0", "credit": "Liz Clayton · CC BY 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Barista", "difficulty": 2, "reviewed": true}, {"subject": "Street artist", "answer": "צייר רחוב", "aliases": ["צייר", "צייר דיוקנאות"], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Paris_July_2011-2.jpg/500px-Paris_July_2011-2.jpg", "source": "https://commons.wikimedia.org/wiki/File:Paris_July_2011-2.jpg", "license": "CC BY-SA 3.0", "artist": "Alvesgaspar", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "Alvesgaspar · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Street_artist", "difficulty": 2, "reviewed": true}, {"subject": "Chef", "answer": "שף", "aliases": ["טבח"], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b5/Chefs.jpg/500px-Chefs.jpg", "source": "https://commons.wikimedia.org/wiki/File:Chefs.jpg", "license": "Public domain", "artist": "Jongleur100", "licenseUrl": "", "credit": "Jongleur100 · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Chef", "difficulty": 2, "reviewed": true}, {"subject": "Mail carrier", "answer": "דוור", "aliases": ["דואר", "שליח דואר"], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Postman_on_Wandle_Rd%2C_SW17_%285479444030%29.jpg/500px-Postman_on_Wandle_Rd%2C_SW17_%285479444030%29.jpg", "source": "https://commons.wikimedia.org/wiki/File:Postman_on_Wandle_Rd,_SW17_(5479444030).jpg", "license": "CC BY 2.0", "artist": "Herry Lawford  from Stockbridge, UK", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "credit": "Herry Lawford  from Stockbridge, UK · CC BY 2.0", "subjectSource": "https://en.wikipedia.org/wiki/Mail_carrier", "difficulty": 2, "reviewed": true}, {"subject": "Shoemaking", "answer": "סנדלר", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e6/Cobbler_repairing_shoes_in_old_workshop_%28Bazaar_in_Bitola%2C_Macedonia%2C_2025%29.jpg/500px-Cobbler_repairing_shoes_in_old_workshop_%28Bazaar_in_Bitola%2C_Macedonia%2C_2025%29.jpg", "source": "https://commons.wikimedia.org/wiki/File:Cobbler_repairing_shoes_in_old_workshop_(Bazaar_in_Bitola,_Macedonia,_2025).jpg", "license": "CC BY-SA 4.0", "artist": "Petar Milošević", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Petar Milošević · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Shoemaking", "difficulty": 2, "reviewed": true}, {"subject": "Conducting", "answer": "מנצח", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/Holland_Festival_dirigent_Leonard_Bernstein_zal_het_met_het_Concertgebouworkes%2C_Bestanddeelnr_933-3400.jpg/500px-Holland_Festival_dirigent_Leonard_Bernstein_zal_het_met_het_Concertgebouworkes%2C_Bestanddeelnr_933-3400.jpg", "source": "https://commons.wikimedia.org/wiki/File:Holland_Festival_dirigent_Leonard_Bernstein_zal_het_met_het_Concertgebouworkes,_Bestanddeelnr_933-3400.jpg", "license": "CC0", "artist": "Sjakkelien Vollebregt", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "credit": "Sjakkelien Vollebregt · CC0", "subjectSource": "https://en.wikipedia.org/wiki/Conducting", "difficulty": 2, "reviewed": true}], "photo-travel": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cb/Wanderlust.jpg/960px-Wanderlust.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "נעלי הליכה", "aliases": [], "difficulty": 4, "credit": "Amanda Sandlin · CC0 · Alternative: http://unsplash.com/photos/4F1ijaoCTlg Amanda Sandlin http://unsplash.com/post/96933087474/download-by-steven-lewis http://s3.amazonaws.com/ooomf-com-files/sh3y2u5PSaKq8c4LxB3B_submission-photo-4.jpg http://static.squarespace.com/static/5301713fe4b01cb1fb2f4b68/53d8984be4b0873b56404117/53d8984ee4b061b2d2221f8e/1406703701481/4_wanderlust.jpg", "source": "https://commons.wikimedia.org/wiki/File:Wanderlust.jpg", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "artist": "Amanda Sandlin", "subjectSource": "https://en.wikipedia.org/wiki/Hiking_boot", "subjectTitle": "Hiking boot", "imageDescription": "Vido al homa krurparo kun botoj sur monteĝo ŝtonoza, kontraŭ nebula fono.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/Crampon.JPG/960px-Crampon.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קרמפונים", "aliases": ["דוקרני קרח"], "difficulty": 4, "credit": "Dbaisley  at  English Wikipedia · Public domain", "source": "https://commons.wikimedia.org/wiki/File:Crampon.JPG", "license": "Public domain", "licenseUrl": "", "artist": "Dbaisley  at  English Wikipedia", "subjectSource": "https://en.wikipedia.org/wiki/Crampon", "subjectTitle": "Crampon", "imageDescription": "Crampons", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Ice_axe.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "גרזן קרח", "aliases": [], "difficulty": 4, "credit": "Lacen · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Ice_axe.png", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Lacen", "subjectSource": "https://en.wikipedia.org/wiki/Ice_axe", "subjectTitle": "Ice axe", "imageDescription": "Ice axe", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Assorted_Biners.jpg/960px-Assorted_Biners.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קרבינה", "aliases": ["שאקל"], "difficulty": 4, "credit": "Zakabog · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Assorted_Biners.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Zakabog", "subjectSource": "https://en.wikipedia.org/wiki/Carabiner", "subjectTitle": "Carabiner", "imageDescription": "Assorted carabiners, clockwise from top left - D shape wire gate, straight gate, oval shape straight gate, auto lock, twist lock.  Pictured center is a standard carabiner rating.NOTE: the orange tape is for identifying an individuals equipment.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Black_Diamond_Spot_on_Half_Dome_Helmet.JPG/960px-Black_Diamond_Spot_on_Half_Dome_Helmet.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "פנס ראש", "aliases": [], "difficulty": 4, "credit": "Eric T Gunther · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Black_Diamond_Spot_on_Half_Dome_Helmet.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Eric T Gunther", "subjectSource": "https://en.wikipedia.org/wiki/Headlamp_(outdoor)", "subjectTitle": "Headlamp (outdoor)", "imageDescription": "Black Diamond Spot attached to the Half Dome helmet", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/LED_Flashlights.jpg/960px-LED_Flashlights.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "פנס", "aliases": [], "difficulty": 4, "credit": "Brownse10 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:LED_Flashlights.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Brownse10", "subjectSource": "https://en.wikipedia.org/wiki/Flashlight", "subjectTitle": "Flashlight", "imageDescription": "A set of LED flashlights. C8 style on the left (Sofirn C8T: up to 1,310 lm), tube style on the right (Sofirn SP31; up to 1,100 lm).", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Mattress.jpg/960px-Mattress.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מזרן שטח", "aliases": [], "difficulty": 4, "credit": "No machine-readable author provided.  Ilkant~commonswiki  assumed (based on copyright claims). · Public domain · No machine-readable source provided. Own work assumed (based on copyright claims).", "source": "https://commons.wikimedia.org/wiki/File:Mattress.jpg", "license": "Public domain", "licenseUrl": "", "artist": "No machine-readable author provided.  Ilkant~commonswiki  assumed (based on copyright claims).", "subjectSource": "https://en.wikipedia.org/wiki/Sleeping_pad", "subjectTitle": "Sleeping pad", "imageDescription": "Mattress", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Inpregnanted_mosquito_nets_in_a_malarial_area_in_Mozambique_Africa.jpg/960px-Inpregnanted_mosquito_nets_in_a_malarial_area_in_Mozambique_Africa.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כילה", "aliases": [], "difficulty": 4, "credit": "FrogsLegs71 · CC BY-SA 3.0 · The photographer", "source": "https://commons.wikimedia.org/wiki/File:Inpregnanted_mosquito_nets_in_a_malarial_area_in_Mozambique_Africa.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "FrogsLegs71", "subjectSource": "https://en.wikipedia.org/wiki/Mosquito_net", "subjectTitle": "Mosquito net", "imageDescription": "Inpregnanted mosquito nets in a malarial area in Mozambique Africa", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/Jack_Wolfskin_money_belt_-_brown.JPG/960px-Jack_Wolfskin_money_belt_-_brown.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חגורת כסף", "aliases": [], "difficulty": 4, "credit": "User:Mattes · Public domain", "source": "https://commons.wikimedia.org/wiki/File:Jack_Wolfskin_money_belt_-_brown.JPG", "license": "Public domain", "licenseUrl": "", "artist": "User:Mattes", "subjectSource": "https://en.wikipedia.org/wiki/Money_belt", "subjectTitle": "Money belt", "imageDescription": "Money belt with zip made by Jack Wolfskin", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Suitcase2.jpg/960px-Suitcase2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מנעול מזוודה", "aliases": [], "difficulty": 4, "credit": "JEXP · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Suitcase2.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "JEXP", "subjectSource": "https://en.wikipedia.org/wiki/Luggage_lock", "subjectTitle": "Luggage lock", "imageDescription": "TSA luggage lock", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Bahnautomat.jpg/960px-Bahnautomat.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מכונת כרטיסים", "aliases": [], "difficulty": 4, "credit": "Flominator · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Bahnautomat.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Flominator", "subjectSource": "https://en.wikipedia.org/wiki/Ticket_machine", "subjectTitle": "Ticket machine", "imageDescription": "Ticket machines of Deutsche Bahn in Hinterzarten, Germany", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Sierra_Nevada_Laguna_skilift_3.jpg/960px-Sierra_Nevada_Laguna_skilift_3.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "רכבל כיסאות", "aliases": [], "difficulty": 4, "credit": "kallerna · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Sierra_Nevada_Laguna_skilift_3.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "kallerna", "subjectSource": "https://en.wikipedia.org/wiki/Chairlift", "subjectTitle": "Chairlift", "imageDescription": "Laguna ski lift - Laguna de las Yeguas Ski Station in Sierra Nevada, Spain.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Metro_Centrum_Nauki_Kopernik_Schody-AB.jpg/960px-Metro_Centrum_Nauki_Kopernik_Schody-AB.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מדרגות נעות", "aliases": [], "difficulty": 4, "credit": "Chepry   💬  ( Andrzej Barabasz )  📷   🇵🇱 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Metro_Centrum_Nauki_Kopernik_Schody-AB.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Chepry   💬  ( Andrzej Barabasz )  📷   🇵🇱", "subjectSource": "https://en.wikipedia.org/wiki/Escalator", "subjectTitle": "Escalator", "imageDescription": "40 meters long escalator in  Centrum Nauki Kopernik metro station  in  Warsaw  (the longest in Poland)", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/CG2_Changi_Airport_Linkbridge_20200919_212128.jpg/960px-CG2_Changi_Airport_Linkbridge_20200919_212128.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מסוע הולכי רגל", "aliases": [], "difficulty": 4, "credit": "ZKang123 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:CG2_Changi_Airport_Linkbridge_20200919_212128.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "ZKang123", "subjectSource": "https://en.wikipedia.org/wiki/Moving_walkway", "subjectTitle": "Moving walkway", "imageDescription": "CG2 Changi Airport Linkbridge", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Turnstiles_in_Alewife_station%2C_August_2005.jpg/960px-Turnstiles_in_Alewife_station%2C_August_2005.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קרוסלת כניסה", "aliases": [], "difficulty": 4, "credit": "User:ArnoldReinhold · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Turnstiles_in_Alewife_station,_August_2005.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "User:ArnoldReinhold", "subjectSource": "https://en.wikipedia.org/wiki/Turnstile", "subjectTitle": "Turnstile", "imageDescription": "Turnstiles at Alewife station in August 2005", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/e/ef/SLC_bus%2C1909.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "אוטובוס תיירים", "aliases": [], "difficulty": 4, "credit": "Unknown author Unknown author · Public domain · URL: http://content.lib.utah.edu/cdm4/item_viewer.php?CISOROOT=/USHS_Shipler&CISOPTR=1539&CISOBOX=1&REC=6 . Transferred from en.wikipedia to Commons by User:Oxyman using CommonsHelper . Original uploader was Tillman at en.wikipedia on 7 July 2008.", "source": "https://commons.wikimedia.org/wiki/File:SLC_bus,1909.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Unknown author Unknown author", "subjectSource": "https://en.wikipedia.org/wiki/Tour_bus_service", "subjectTitle": "Tour bus service", "imageDescription": "Sightseeing bus in Salt Lake City, Utah, 1909. Commercial photo taken on assignment, published circa 1909", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Dodge-based_recreational_vehicle_in_Munich.JPG/960px-Dodge-based_recreational_vehicle_in_Munich.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קרוואן ממונע", "aliases": [], "difficulty": 4, "credit": "High Contrast · CC BY 3.0 de", "source": "https://commons.wikimedia.org/wiki/File:Dodge-based_recreational_vehicle_in_Munich.JPG", "license": "CC BY 3.0 de", "licenseUrl": "https://creativecommons.org/licenses/by/3.0/de/deed.en", "artist": "High Contrast", "subjectSource": "https://en.wikipedia.org/wiki/Recreational_vehicle", "subjectTitle": "Recreational vehicle", "imageDescription": "Dodge-based recreational vehicle (Winnebago motor home) in Munich.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Multi-use_water_bottle.JPG/960px-Multi-use_water_bottle.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "בקבוק מים", "aliases": [], "difficulty": 4, "credit": "Amraepowell · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Multi-use_water_bottle.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Amraepowell", "subjectSource": "https://en.wikipedia.org/wiki/Water_bottle", "subjectTitle": "Water bottle", "imageDescription": "Examples of multi-use copolyester water bottles.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Hydration_pack.jpg/960px-Hydration_pack.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "שלוקר", "aliases": [], "difficulty": 4, "credit": "Uploaded to the English language Wikipedia by user  Toytoy · CC BY-SA 3.0 · Hydration pack.jpg at the English language Wikipedia", "source": "https://commons.wikimedia.org/wiki/File:Hydration_pack.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Uploaded to the English language Wikipedia by user  Toytoy", "subjectSource": "https://en.wikipedia.org/wiki/Hydration_pack", "subjectTitle": "Hydration pack", "imageDescription": "Hydration pack  manufactured by  CamelBak", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Tent_Peg_7652.jpg/960px-Tent_Peg_7652.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "יתד אוהל", "aliases": [], "difficulty": 4, "credit": "Ashley Pomeroy · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Tent_Peg_7652.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Ashley Pomeroy", "subjectSource": "https://en.wikipedia.org/wiki/Tent_peg", "subjectTitle": "Tent peg", "imageDescription": "An aluminium tent peg", "reviewed": true}], "photo-technology": [{"image": "https://upload.wikimedia.org/wikipedia/commons/4/4b/RTX_5080.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "כרטיס מסך", "aliases": [], "difficulty": 4, "credit": "XD7006 · CC BY 4.0", "source": "https://commons.wikimedia.org/wiki/File:RTX_5080.png", "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0", "artist": "XD7006", "subjectSource": "https://en.wikipedia.org/wiki/Graphics_card", "subjectTitle": "Graphics card", "imageDescription": "A photo of an NVIDIA Founders Edition RTX 5080", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/50/Xbox_360E_Winchester_Top_View.png/960px-Xbox_360E_Winchester_Top_View.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "לוח אם", "aliases": [], "difficulty": 4, "credit": "jnftech · CC BY-SA 4.0 · consolemods.org", "source": "https://commons.wikimedia.org/wiki/File:Xbox_360E_Winchester_Top_View.png", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "jnftech", "subjectSource": "https://en.wikipedia.org/wiki/Motherboard", "subjectTitle": "Motherboard", "imageDescription": "Xbox 306E motherboard, \"Winchester\" version, 32 nm Oban CGPU, Part #: X879957", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/Swissbit_2GB_PC2-5300U-555.jpg/960px-Swissbit_2GB_PC2-5300U-555.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "זיכרון מחשב", "aliases": ["ראם", "RAM"], "difficulty": 4, "credit": "An-d · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Swissbit_2GB_PC2-5300U-555.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "An-d", "subjectSource": "https://en.wikipedia.org/wiki/Random-access_memory", "subjectTitle": "Random-access memory", "imageDescription": "Swissbit 8GB PC2-5300U-555 DDR2 RAM", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Intel_i9-14900KF_CPU.jpg/960px-Intel_i9-14900KF_CPU.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מעבד", "aliases": [], "difficulty": 4, "credit": "Pstrahl · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Intel_i9-14900KF_CPU.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Pstrahl", "subjectSource": "https://en.wikipedia.org/wiki/Central_processing_unit", "subjectTitle": "Central processing unit", "imageDescription": "A photo of the Intel i9 14900KF CPU from above", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Google_Home_sitting_on_table.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "רמקול חכם", "aliases": [], "difficulty": 4, "credit": "NDB Photos · CC BY-SA 2.0 · Google Home tech", "source": "https://commons.wikimedia.org/wiki/File:Google_Home_sitting_on_table.jpg", "license": "CC BY-SA 2.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "artist": "NDB Photos", "subjectSource": "https://en.wikipedia.org/wiki/Smart_speaker", "subjectTitle": "Smart speaker", "imageDescription": "Google's smart speaker, the Google Home", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/4/46/USB_hub.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "רכזת USB", "aliases": [], "difficulty": 4, "credit": "The original uploader was  Ds13  at  English Wikipedia .\n \nLater versions were uploaded by  Marcan ,  Asim18  at  en.wikipedia . · CC BY-SA 2.5 · Transferred from en.wikipedia to Commons.", "source": "https://commons.wikimedia.org/wiki/File:USB_hub.jpg", "license": "CC BY-SA 2.5", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5", "artist": "The original uploader was  Ds13  at  English Wikipedia .\n \nLater versions were uploaded by  Marcan ,  Asim18  at  en.wikipedia .", "subjectSource": "https://en.wikipedia.org/wiki/USB_hub", "subjectTitle": "USB hub", "imageDescription": "Small USB charging station hub.\n \nPhoto taken with a  Canon Digital IXUS 400  camera. Post-processing (resizing) done with  en:ImageMagick  on an  en:x86_64   en:Gentoo Linux  system (command line:  convert -resize 320x240 img_0002.jpg usb_hub.jpg ).", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Sony_CRX310S-Internal-PC-DVD-Drive-Opened.jpg/960px-Sony_CRX310S-Internal-PC-DVD-Drive-Opened.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כונן תקליטורים", "aliases": [], "difficulty": 4, "credit": "Evan-Amos · Public domain", "source": "https://commons.wikimedia.org/wiki/File:Sony_CRX310S-Internal-PC-DVD-Drive-Opened.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Evan-Amos", "subjectSource": "https://en.wikipedia.org/wiki/Optical_disc_drive", "subjectTitle": "Optical disc drive", "imageDescription": "An internal DVD/CD writer drive for a computer, made by Sony, in the open position.  This 5.25\" drive is capable of burning and reading CDs and DVDs, and attaches with a SATA connector.  The model is CRX3105-DB.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6f/Museum_f%C3%BCr_Kommunikation_-_Depot_Heusenstamm_-_Technik_12_-_Flickr_-_KlausNahr.jpg/960px-Museum_f%C3%BCr_Kommunikation_-_Depot_Heusenstamm_-_Technik_12_-_Flickr_-_KlausNahr.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "טלוויזיה", "aliases": [], "difficulty": 4, "credit": "Klaus Nahr  from Germany · CC BY-SA 2.0 · Museum für Kommunikation - Depot Heusenstamm - Technik 12", "source": "https://commons.wikimedia.org/wiki/File:Museum_f%C3%BCr_Kommunikation_-_Depot_Heusenstamm_-_Technik_12_-_Flickr_-_KlausNahr.jpg", "license": "CC BY-SA 2.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "artist": "Klaus Nahr  from Germany", "subjectSource": "https://en.wikipedia.org/wiki/Television_set", "subjectTitle": "Television set", "imageDescription": "Fernseher", "reviewed": true}, {"subject": "Oscilloscope", "answer": "אוסצילוסקופ", "aliases": ["סקופ"], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Tektronix_Oscilloscope_475A.jpg/500px-Tektronix_Oscilloscope_475A.jpg", "source": "https://commons.wikimedia.org/wiki/File:Tektronix_Oscilloscope_475A.jpg", "license": "CC BY-SA 4.0", "artist": "Pittigrilli", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Pittigrilli · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Oscilloscope", "difficulty": 2, "reviewed": true}], "photo-body": [{"image": "https://upload.wikimedia.org/wikipedia/commons/4/45/Geisha-kyoto-2004-11-21.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "עורף", "aliases": [], "difficulty": 4, "credit": "Daniel Bachler · CC BY-SA 2.5", "source": "https://commons.wikimedia.org/wiki/File:Geisha-kyoto-2004-11-21.jpg", "license": "CC BY-SA 2.5", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5", "artist": "Daniel Bachler", "subjectSource": "https://en.wikipedia.org/wiki/Nape", "subjectTitle": "Nape", "imageDescription": "2 Maiko (apprentice Geisha) conversing near the Golden Temple in Kyoto, Japan. Parts of the kimono and the special make-up are clearly visible. Foreground: senior maiko donning the ofuku hairstyle, background: junior maiko marked by the profusion of hair decorations and the inclusion of long trailing tsumami (shidare kanzashi).", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Vesnuschki.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "נמש", "aliases": [], "difficulty": 4, "credit": "Loyna · CC BY-SA 2.5", "source": "https://commons.wikimedia.org/wiki/File:Vesnuschki.jpg", "license": "CC BY-SA 2.5", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5", "artist": "Loyna", "subjectSource": "https://en.wikipedia.org/wiki/Freckle", "subjectTitle": "Freckle", "imageDescription": "Freckles", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3f/Index_finger_%3D_to_attention.JPG/960px-Index_finger_%3D_to_attention.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "אצבע מורה", "aliases": [], "difficulty": 4, "credit": "Pogrebnoj-Alexandroff · CC BY-SA 3.0 · open free cources", "source": "https://commons.wikimedia.org/wiki/File:Index_finger_%3D_to_attention.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Pogrebnoj-Alexandroff", "subjectSource": "https://en.wikipedia.org/wiki/Index_finger", "subjectTitle": "Index finger", "imageDescription": "fingers", "reviewed": true}, {"subject": "Fist", "answer": "אגרוף", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Closed_fist.jpg/500px-Closed_fist.jpg", "source": "https://commons.wikimedia.org/wiki/File:Closed_fist.jpg", "license": "CC BY-SA 4.0", "artist": "Cedar Tree", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Cedar Tree · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Fist", "difficulty": 2, "reviewed": true}, {"subject": "Nostril", "answer": "נחיר", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Human_Nostrils_01.JPG/500px-Human_Nostrils_01.JPG", "source": "https://commons.wikimedia.org/wiki/File:Human_Nostrils_01.JPG", "license": "CC BY-SA 3.0", "artist": "Kuebi  = Armin Kübelbeck", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "Kuebi  = Armin Kübelbeck · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Nostril", "difficulty": 2, "reviewed": true}, {"subject": "Mole (skin marking)", "answer": "נקודת חן", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Nevus_NCI.jpg/500px-Nevus_NCI.jpg", "source": "https://commons.wikimedia.org/wiki/File:Nevus_NCI.jpg", "license": "Public domain", "artist": "National Cancer Institute", "licenseUrl": "", "credit": "National Cancer Institute · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Nevus", "difficulty": 2, "reviewed": true}], "photo-sport": [{"subject": "Darts", "answer": "קליעה למטרה", "aliases": ["דארטס"], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Darts_in_a_dartboard.jpg/960px-Darts_in_a_dartboard.jpg", "source": "https://commons.wikimedia.org/wiki/File:Darts_in_a_dartboard.jpg", "license": "Public domain", "artist": "PeterPan23", "licenseUrl": "", "credit": "PeterPan23 · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Darts", "difficulty": 2, "reviewed": true}, {"subject": "Skipping rope", "answer": "חבל קפיצה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Ghanaian_kid_%28skipping_rope%29_06_%28cropped%29.jpg/960px-Ghanaian_kid_%28skipping_rope%29_06_%28cropped%29.jpg", "source": "https://commons.wikimedia.org/wiki/File:Ghanaian_kid_(skipping_rope)_06_(cropped).jpg", "license": "CC BY-SA 4.0", "artist": "Pambelle12", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Pambelle12 · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Skipping_rope", "difficulty": 3, "reviewed": true}, {"subject": "Trampoline", "answer": "טרמפולינה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cc/Hometrampoline.jpg/960px-Hometrampoline.jpg", "source": "https://commons.wikimedia.org/wiki/File:Hometrampoline.jpg", "license": "Public domain", "artist": "Ludraman", "licenseUrl": "", "credit": "Ludraman · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Trampoline", "difficulty": 3, "reviewed": true}, {"subject": "Flying disc", "answer": "פריזבי", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Frisbee_090719.jpg/960px-Frisbee_090719.jpg", "source": "https://commons.wikimedia.org/wiki/File:Frisbee_090719.jpg", "license": "Public domain", "artist": "Petey21", "licenseUrl": "", "credit": "Petey21 · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Frisbee", "difficulty": 2, "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Mondial_Ping_-_Men%27s_Singles_-_Round_4_-_Kenta_Matsudaira-Vladimir_Samsonov_-_57.jpg/960px-Mondial_Ping_-_Men%27s_Singles_-_Round_4_-_Kenta_Matsudaira-Vladimir_Samsonov_-_57.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "טניס שולחן", "aliases": [], "difficulty": 4, "credit": "Pierre-Yves Beaudouin · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Mondial_Ping_-_Men%27s_Singles_-_Round_4_-_Kenta_Matsudaira-Vladimir_Samsonov_-_57.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Pierre-Yves Beaudouin", "subjectSource": "https://en.wikipedia.org/wiki/Table_tennis", "subjectTitle": "Table tennis", "imageDescription": "2013 World Table Tennis Championships, Paris. Men's Singles Round 4.  Kenta Matsudaira  vs  Vladimir Samsonov .", "reviewed": true}], "photo-buildings": [{"subject": "Observatory", "answer": "מצפה כוכבים", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Royal_observatory_Greenwich.JPG/960px-Royal_observatory_Greenwich.JPG", "source": "https://commons.wikimedia.org/wiki/File:Royal_observatory_Greenwich.JPG", "license": "CC BY-SA 3.0", "artist": "Adusha", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "Adusha · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Observatory", "difficulty": 3, "reviewed": true}, {"subject": "Radio telescope", "answer": "רדיו טלסקופ", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/CSIRO_ScienceImage_4350_CSIROs_Parkes_Radio_Telescope_with_moon_in_the_background.jpg/960px-CSIRO_ScienceImage_4350_CSIROs_Parkes_Radio_Telescope_with_moon_in_the_background.jpg", "source": "https://commons.wikimedia.org/wiki/File:CSIRO_ScienceImage_4350_CSIROs_Parkes_Radio_Telescope_with_moon_in_the_background.jpg", "license": "CC BY 3.0", "artist": "division,  CSIRO", "licenseUrl": "https://creativecommons.org/licenses/by/3.0", "credit": "division,  CSIRO · CC BY 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Radio_telescope", "difficulty": 3, "reviewed": true}, {"subject": "Supermarket", "answer": "סופרמרקט", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Stop%26Shop.jpg/960px-Stop%26Shop.jpg", "source": "https://commons.wikimedia.org/wiki/File:Stop%26Shop.jpg", "license": "CC BY-SA 4.0", "artist": "NYC Guru", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "NYC Guru · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Supermarket", "difficulty": 3, "reviewed": true}, {"subject": "Market stall", "answer": "דוכן שוק", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Greek_sponges.JPG/960px-Greek_sponges.JPG", "source": "https://commons.wikimedia.org/wiki/File:Greek_sponges.JPG", "license": "Public domain", "artist": "The original uploader was  KF  at  English Wikipedia .", "licenseUrl": "", "credit": "The original uploader was  KF  at  English Wikipedia . · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Market_stall", "difficulty": 3, "reviewed": true}], "photo-clothing": [{"image": "https://upload.wikimedia.org/wikipedia/commons/7/71/Sven_Palmqvist_1965.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "כומתה", "aliases": [], "difficulty": 4, "credit": "familjen Palmqvist · Public domain · Sköna hem", "source": "https://commons.wikimedia.org/wiki/File:Sven_Palmqvist_1965.jpg", "license": "Public domain", "licenseUrl": "", "artist": "familjen Palmqvist", "subjectSource": "https://en.wikipedia.org/wiki/Beret", "subjectTitle": "Beret", "imageDescription": "Glaskonstnären Sven Palmqvist (1906-1984)", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/7/7e/Bowler_hat%2C_Vienna%2C_mid-20th_century.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "כובע באולר", "aliases": [], "difficulty": 4, "credit": "Peloponnesian Folklore Foundation · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Bowler_hat,_Vienna,_mid-20th_century.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Peloponnesian Folklore Foundation", "subjectSource": "https://en.wikipedia.org/wiki/Bowler_hat", "subjectTitle": "Bowler hat", "imageDescription": "Μπόουλερ μαύρο.\n Βιέννη  \n \n1998.6.221 / Συλλογή Πελοποννησιακού Λαογραφικού Ιδρύματος", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/1/1e/Woman_in_leather_jacket_on_Vespa%2C_Antwerp_Belgium.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "מעיל עור", "aliases": [], "difficulty": 4, "credit": "Fouquier ॐ  from Berendrecht, Belgium · CC0 · Vespa Girl", "source": "https://commons.wikimedia.org/wiki/File:Woman_in_leather_jacket_on_Vespa,_Antwerp_Belgium.jpg", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "artist": "Fouquier ॐ  from Berendrecht, Belgium", "subjectSource": "https://en.wikipedia.org/wiki/Leather_jacket", "subjectTitle": "Leather jacket", "imageDescription": "Woman wearing leather jacket on Vespa scooter in Antwerp, Belgium.\n \nSince I do not believe in the principle of copyright all my shots can be downloaded and used free at will without any prior consent.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Sari_on_mannequin_for_demo.jpg/960px-Sari_on_mannequin_for_demo.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סארי", "aliases": [], "difficulty": 4, "credit": "Suyash.dwivedi · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Sari_on_mannequin_for_demo.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Suyash.dwivedi", "subjectSource": "https://en.wikipedia.org/wiki/Sari", "subjectTitle": "Sari", "imageDescription": "Sari on mannequin for demo in Sant Hiridaram Nagar, india", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Hanbok_Day_2016_29_%2830467033136%29.jpg/960px-Hanbok_Day_2016_29_%2830467033136%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "הנבוק", "aliases": [], "difficulty": 4, "credit": "Republic of  Korea  from Seoul, Republic of Korea · CC BY-SA 2.0 · Hanbok_Day_2016_29", "source": "https://commons.wikimedia.org/wiki/File:Hanbok_Day_2016_29_(30467033136).jpg", "license": "CC BY-SA 2.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "artist": "Republic of  Korea  from Seoul, Republic of Korea", "subjectSource": "https://en.wikipedia.org/wiki/Hanbok", "subjectTitle": "Hanbok", "imageDescription": "The Day of Hanbok\n  October 22. 2016\n  Gyeongbokgung, Jongno-gu, Seoul\n  Ministry of Culture, Sports and Tourism\nKorean Culture and Information Service\nKorea.net (<a href=\" http://www.korea.net \" rel=\"nofollow\">www.korea.net</a>)\nOfficial Photographer : Jeon Han\n  This official Republic of Korea photograph is being made available only for publication by news organizations and/or for personal printing by the subject(s) of the photograph. The photograph may not be manipulated in any way. Also, it may not be used in any type of commercial, advertisement, product or promotion that in any way suggests approval or endorsement from the government of the Republic of Korea. \n \n \n 2016 한복의 날\n  2016-10-22\n  경복궁\n  문화체육관광부\n해외문화홍보원\n코리아넷\n \n전한", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/Klompen_%28Dutch_Clogs%29%2C_Wooden_Shoes_Museum_in_Drenthe.jpg/960px-Klompen_%28Dutch_Clogs%29%2C_Wooden_Shoes_Museum_in_Drenthe.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קבקב", "aliases": [], "difficulty": 4, "credit": "OXLAEY.com · CC BY 2.0 · https://www.flickr.com/photos/oxlaey/15360104254/", "source": "https://commons.wikimedia.org/wiki/File:Klompen_(Dutch_Clogs),_Wooden_Shoes_Museum_in_Drenthe.jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "OXLAEY.com", "subjectSource": "https://en.wikipedia.org/wiki/Clog", "subjectTitle": "Clog", "imageDescription": "Dutch clogs ( klompen ). These (popular) clogs are for everyday use.  Watch the video  https://www.youtube.com/watch?v=8VBR62uQV7Q \n Wooden shoes are still worn and made in The Netherlands. Most are made with machines but still a small number of craftsmen cut scrape and shape blocks of wood into clogs. Most are quite practical but many are works of art. \n  The most unusual are kept at the International Clog Museum,  Internationaal Klompenmuseum , in Eelde. They have thousands of shoes - from Afghanistan to Japan to France and of course from the Netherlands. \n \nMore information at: www.klompenmuseum.nl", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Alpargatas_oliva.jpg/960px-Alpargatas_oliva.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "אספדריל", "aliases": [], "difficulty": 4, "credit": "Cantabrucu · CC0", "source": "https://commons.wikimedia.org/wiki/File:Alpargatas_oliva.jpg", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "artist": "Cantabrucu", "subjectSource": "https://en.wikipedia.org/wiki/Espadrille", "subjectTitle": "Espadrille", "imageDescription": "Olive colour Spanish \"Alpargatas\" or Espadrilles.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Ballet_shoes_in_fifth_position.jpg/960px-Ballet_shoes_in_fifth_position.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "נעלי בלט", "aliases": [], "difficulty": 4, "credit": "Lambtron · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Ballet_shoes_in_fifth_position.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Lambtron", "subjectSource": "https://en.wikipedia.org/wiki/Ballet_shoe", "subjectTitle": "Ballet shoe", "imageDescription": "A dancer wearing  ballet shoes , with feet in  fifth position .", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/%D7%9B%D7%A4%D7%AA%D7%95%D7%A8_%D7%97%D7%A4%D7%AA.jpg/960px-%D7%9B%D7%A4%D7%AA%D7%95%D7%A8_%D7%97%D7%A4%D7%AA.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חפת", "aliases": [], "difficulty": 4, "credit": "מנחם יוסיפון · CC0 · אני בעל זכויות היוצרים", "source": "https://commons.wikimedia.org/wiki/File:%D7%9B%D7%A4%D7%AA%D7%95%D7%A8_%D7%97%D7%A4%D7%AA.jpg", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "artist": "מנחם יוסיפון", "subjectSource": "https://en.wikipedia.org/wiki/Cufflink", "subjectTitle": "Cufflink", "imageDescription": "חפת עם כפתור חפת", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Josh_Wilson_005.JPG/960px-Josh_Wilson_005.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "שלייקס", "aliases": ["כתפיות"], "difficulty": 4, "credit": "Alwayzsinging25 · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Josh_Wilson_005.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Alwayzsinging25", "subjectSource": "https://en.wikipedia.org/wiki/Suspenders", "subjectTitle": "Suspenders", "imageDescription": "Josh Wilson Suspenders", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/In_Conversation%2C_Yemen_%2812694670333%29.jpg/960px-In_Conversation%2C_Yemen_%2812694670333%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כאפייה", "aliases": [], "difficulty": 4, "credit": "Rod Waddington  from Kergunyah, Australia · CC BY-SA 2.0 · In Conversation, Yemen", "source": "https://commons.wikimedia.org/wiki/File:In_Conversation,_Yemen_(12694670333).jpg", "license": "CC BY-SA 2.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "artist": "Rod Waddington  from Kergunyah, Australia", "subjectSource": "https://en.wikipedia.org/wiki/Keffiyeh", "subjectTitle": "Keffiyeh", "imageDescription": "In Conversation, Yemen", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Safety_Pin.jpg/960px-Safety_Pin.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סיכת ביטחון", "aliases": [], "difficulty": 4, "credit": "Haragayato · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Safety_Pin.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Haragayato", "subjectSource": "https://en.wikipedia.org/wiki/Safety_pin", "subjectTitle": "Safety pin", "imageDescription": "Safety pin , photo taken in  Japan .", "reviewed": true}], "photo-games": [{"image": "https://upload.wikimedia.org/wikipedia/commons/8/84/Connect-four.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "ארבע בשורה", "aliases": [], "difficulty": 4, "credit": "Jonathan Kellenberg  from Seattle, WA · CC BY 2.0 · Flickr", "source": "https://commons.wikimedia.org/wiki/File:Connect-four.jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "Jonathan Kellenberg  from Seattle, WA", "subjectSource": "https://en.wikipedia.org/wiki/Connect_Four", "subjectTitle": "Connect Four", "imageDescription": "Material und Spielprinzip.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Hra_n%C3%A1mo%C5%99n%C3%AD_bitva_%281%29.jpg/960px-Hra_n%C3%A1mo%C5%99n%C3%AD_bitva_%281%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "צוללות", "aliases": [], "difficulty": 4, "credit": "I would appreciate  being notified  if you use my work outside Wikimedia.\n Do not copy this image illegally by ignoring the terms of the license below, as it is not in the public domain. If you would like special permission to use, license, or purchase the image please  contact me  to negotiate terms.\n \nMore of my work can be found in my  personal gallery . · CC BY-SA 3.0 · Own work This photograph was taken with a Panasonic Lumix DMC-TZ5 This file was uploaded with Commonist .", "source": "https://commons.wikimedia.org/wiki/File:Hra_n%C3%A1mo%C5%99n%C3%AD_bitva_(1).jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "I would appreciate  being notified  if you use my work outside Wikimedia.\n Do not copy this image illegally by ignoring the terms of the license below, as it is not in the public domain. If you would like special permission to use, license, or purchase the image please  contact me  to negotiate terms.\n \nMore of my work can be found in my  personal gallery .", "subjectSource": "https://en.wikipedia.org/wiki/Battleship_(game)", "subjectTitle": "Battleship (game)", "imageDescription": "Table game Naval battle", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Othello_Spielbrett.jpg/960px-Othello_Spielbrett.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "רברסי", "aliases": [], "difficulty": 4, "credit": "Neuhaus · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Othello_Spielbrett.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Neuhaus", "subjectSource": "https://en.wikipedia.org/wiki/Reversi", "subjectTitle": "Reversi", "imageDescription": "Othello Spielbrett mit einer halbtransparenten Hand die einen möglichen Spielzug zeigt", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/3/3e/ChineseCheckersboard.jpeg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "דמקה סינית", "aliases": [], "difficulty": 4, "credit": "The original uploader was  Hephaestos  at  English Wikipedia . · CC BY-SA 3.0 · Transferred from en.wikipedia to Commons.", "source": "https://commons.wikimedia.org/wiki/File:ChineseCheckersboard.jpeg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "The original uploader was  Hephaestos  at  English Wikipedia .", "subjectSource": "https://en.wikipedia.org/wiki/Chinese_checkers", "subjectTitle": "Chinese checkers", "imageDescription": "Chinese Checkers board (photo by  en:User:Hephaestos  3/7/2004 GFDL)", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Yao_People_Playing_%22Bawo%22.jpg/960px-Yao_People_Playing_%22Bawo%22.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מנקלה", "aliases": [], "difficulty": 4, "credit": "MozMozJ · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Yao_People_Playing_%22Bawo%22.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "MozMozJ", "subjectSource": "https://en.wikipedia.org/wiki/Mancala", "subjectTitle": "Mancala", "imageDescription": "A 2 person game that is very popular in Malawi and Mozambique.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/f/f3/Replica_of_Eckhardt_Wettlaufer_%27oldest_known%27_crokinole_board_at_Joseph_Schneider_Haus_Museum_in_Kitchener%2C_Ontario%2C_Canada.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "קרוקינול", "aliases": [], "difficulty": 4, "credit": "David Victor Lagasse · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Replica_of_Eckhardt_Wettlaufer_%27oldest_known%27_crokinole_board_at_Joseph_Schneider_Haus_Museum_in_Kitchener,_Ontario,_Canada.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "David Victor Lagasse", "subjectSource": "https://en.wikipedia.org/wiki/Crokinole", "subjectTitle": "Crokinole", "imageDescription": "Replica of Eckhardt Wettlaufer 'oldest known' crokinole board at Joseph Schneider Haus Museum in Kitchener, Ontario, Canada", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Mondial_Ping_-_Men%27s_Singles_-_Round_4_-_Kenta_Matsudaira-Vladimir_Samsonov_-_57.jpg/960px-Mondial_Ping_-_Men%27s_Singles_-_Round_4_-_Kenta_Matsudaira-Vladimir_Samsonov_-_57.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "טניס שולחן", "aliases": [], "difficulty": 4, "credit": "Pierre-Yves Beaudouin · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Mondial_Ping_-_Men%27s_Singles_-_Round_4_-_Kenta_Matsudaira-Vladimir_Samsonov_-_57.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Pierre-Yves Beaudouin", "subjectSource": "https://en.wikipedia.org/wiki/Table_tennis", "subjectTitle": "Table tennis", "imageDescription": "2013 World Table Tennis Championships, Paris. Men's Singles Round 4.  Kenta Matsudaira  vs  Vladimir Samsonov .", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/2006-02-04_Metal_spiral.jpg/960px-2006-02-04_Metal_spiral.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סלינקי", "aliases": [], "difficulty": 4, "credit": "Roger McLassus · CC BY-SA 3.0 · Picture taken and uploaded by Roger McLassus.", "source": "https://commons.wikimedia.org/wiki/File:2006-02-04_Metal_spiral.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Roger McLassus", "subjectSource": "https://en.wikipedia.org/wiki/Slinky", "subjectTitle": "Slinky", "imageDescription": "Metal slinky.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/Kendama_toy.jpg/960px-Kendama_toy.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קנדמה", "aliases": [], "difficulty": 4, "credit": "Gallaz63 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Kendama_toy.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Gallaz63", "subjectSource": "https://en.wikipedia.org/wiki/Kendama", "subjectTitle": "Kendama", "imageDescription": "Kendama; a traditional wooden japanese skill toy", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/c/c3/Diabolo_large_and_small.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "דיאבולו", "aliases": [], "difficulty": 4, "credit": "en:User:StoatBringer · CC BY-SA 3.0 · http://en.wikipedia.org/wiki/Image:Diabolo_large_and_small.jpg", "source": "https://commons.wikimedia.org/wiki/File:Diabolo_large_and_small.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "en:User:StoatBringer", "subjectSource": "https://en.wikipedia.org/wiki/Diabolo", "subjectTitle": "Diabolo", "imageDescription": "Standard and small-sized Western rubber diabolos, with control sticks in the background", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6d/Bilboquet.jpg/960px-Bilboquet.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "בילבוקה", "aliases": [], "difficulty": 4, "credit": "DC · CC BY 2.5", "source": "https://commons.wikimedia.org/wiki/File:Bilboquet.jpg", "license": "CC BY 2.5", "licenseUrl": "https://creativecommons.org/licenses/by/2.5", "artist": "DC", "subjectSource": "https://en.wikipedia.org/wiki/Cup-and-ball", "subjectTitle": "Cup-and-ball", "imageDescription": "Bilboquet en buis", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Toy_Soldiers_British_Coldstream_Guards.jpg/960px-Toy_Soldiers_British_Coldstream_Guards.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חייל צעצוע", "aliases": [], "difficulty": 4, "credit": "Jcbutler  at  English Wikipedia · Public domain · Transferred from en.wikipedia to Commons.", "source": "https://commons.wikimedia.org/wiki/File:Toy_Soldiers_British_Coldstream_Guards.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Jcbutler  at  English Wikipedia", "subjectSource": "https://en.wikipedia.org/wiki/Toy_soldier", "subjectTitle": "Toy soldier", "imageDescription": "54mm Toy Soldiers representing the British Coldstream Guards during the Crimean War era by Imperial Productions, Greytown, New Zealand. Photo by J. Corey Butler, 2005.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/9/90/Magic8ball.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "כדור הקסם שמונה", "aliases": ["מג׳יק אייט בול"], "difficulty": 4, "credit": "ChristianHeldt · Public domain · Photograph", "source": "https://commons.wikimedia.org/wiki/File:Magic8ball.jpg", "license": "Public domain", "licenseUrl": "", "artist": "ChristianHeldt", "subjectSource": "https://en.wikipedia.org/wiki/Magic_8_Ball", "subjectTitle": "Magic 8 Ball", "imageDescription": "Magic 8 Ball", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Taj_Mahal_drawing_on_an_Etch-A-Sketch.jpg/960px-Taj_Mahal_drawing_on_an_Etch-A-Sketch.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "לוח ציור מכני", "aliases": [], "difficulty": 4, "credit": "Etcha · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Taj_Mahal_drawing_on_an_Etch-A-Sketch.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Etcha", "subjectSource": "https://en.wikipedia.org/wiki/Etch_A_Sketch", "subjectTitle": "Etch A Sketch", "imageDescription": "The Taj Mahal, complete with ripples in the reflection", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/View-Master_Model_G.jpg/960px-View-Master_Model_G.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "ויו מאסטר", "aliases": [], "difficulty": 4, "credit": "ThePassenger · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:View-Master_Model_G.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "ThePassenger", "subjectSource": "https://en.wikipedia.org/wiki/View-Master", "subjectTitle": "View-Master", "imageDescription": "A GAF View-Master Viewer Model G red.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cb/Tangram_set_00.jpg/960px-Tangram_set_00.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "טנגרם", "aliases": [], "difficulty": 4, "credit": "Nevit Dilmen · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Tangram_set_00.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Nevit Dilmen", "subjectSource": "https://en.wikipedia.org/wiki/Tangram", "subjectTitle": "Tangram", "imageDescription": "Wooden Tangram set", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8e/Rubber_duckies_So_many_ducks.jpg/960px-Rubber_duckies_So_many_ducks.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "ברווז גומי", "aliases": [], "difficulty": 4, "credit": "gaetanlee · CC BY 2.0 · https://www.flickr.com/photos/gaetanlee/298160434/", "source": "https://commons.wikimedia.org/wiki/File:Rubber_duckies_So_many_ducks.jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "gaetanlee", "subjectSource": "https://en.wikipedia.org/wiki/Rubber_duck", "subjectTitle": "Rubber duck", "imageDescription": "Rubber_duckies. ラバー・ダック。", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/Duveltje_in_doosje%2C_houten_doosje_met_klepdeksel%2C_met_man_met_hoge_hoed_op_springveer%2C_springt_tevoorschijn_als_de_deksel_ontgrendeld_wordt%2C_objectnr_30270.JPG/960px-Duveltje_in_doosje%2C_houten_doosje_met_klepdeksel%2C_met_man_met_hoge_hoed_op_springveer%2C_springt_tevoorschijn_als_de_deksel_ontgrendeld_wordt%2C_objectnr_30270.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קופסת הפתעה", "aliases": [], "difficulty": 4, "credit": "Museum Rotterdam · CC BY-SA 3.0 · https://museumrotterdam.nl/collectie/item/30270", "source": "https://commons.wikimedia.org/wiki/File:Duveltje_in_doosje,_houten_doosje_met_klepdeksel,_met_man_met_hoge_hoed_op_springveer,_springt_tevoorschijn_als_de_deksel_ontgrendeld_wordt,_objectnr_30270.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Museum Rotterdam", "subjectSource": "https://en.wikipedia.org/wiki/Jack-in-the-box", "subjectTitle": "Jack-in-the-box", "imageDescription": "Objectgegevens     Titel:   \tDuveltje in doosje, houten doosje met klepdeksel, met man met hoge hoed op springveer, springt tevoorschijn als de deksel ontgrendeld wordt   Beschrijving:   \tRechthoekig doosje, scharnierend deksel. Voorzijde en binnenzijde doos van ongeverfd hout. Hoofd van een man (roze met wenkbrauwen, snor, bakkebaarden in reliëf) komt boven de rand van het doosje uit. Alle zijden, behalve de voorzijde, beplakt met roze papier waarop patroon met floraal motief in goudkleur. Binnenzijde deksel: zwart met dito motief.   Herkomst:   \tHuis  Eendrachtsweg  57, Rotterdam.   Trefwoorden:   \t duvel in doos , speelgoed, ontspanningsmiddel\t   Datering:   \t1900 - 1920   Technieken:   \ttextiel, gezaagd, gelijmd\t   Materiaal:   \thout, papier_maché, textiel, papier\t   Afmetingen:   (cm) \thg 10,5 / br 10,0 / dp 10,0   Associatie:   \tspelen, Rotterdam, Stadscentrum, Cool, Eendrachtsweg\t   Vorm & decoratie:   \tfiguur, man\t   Inventarisnr:  \tMuseum Rotterdam 30270", "reviewed": true}], "photo-medical": [{"subject": "Artificial limb", "answer": "רגל תותבת", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Flickr_-_The_U.S._Army_-_U.S._Army_World_Class_Athlete_Program_Paralympic.jpg/960px-Flickr_-_The_U.S._Army_-_U.S._Army_World_Class_Athlete_Program_Paralympic.jpg", "source": "https://commons.wikimedia.org/wiki/File:Flickr_-_The_U.S._Army_-_U.S._Army_World_Class_Athlete_Program_Paralympic.jpg", "license": "Public domain", "artist": "The U.S. Army", "licenseUrl": "", "credit": "The U.S. Army · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Prosthesis", "difficulty": 3, "reviewed": true}, {"subject": "Tourniquet", "answer": "חוסם עורקים", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/17/US_Army_soldier_demonstrates_the_proper_way_to_use_a_combat_action_tourniquet%2C_Nov._6%2C_2008_%28081106-D-1852B-012%29.jpg/500px-US_Army_soldier_demonstrates_the_proper_way_to_use_a_combat_action_tourniquet%2C_Nov._6%2C_2008_%28081106-D-1852B-012%29.jpg", "source": "https://commons.wikimedia.org/wiki/File:US_Army_soldier_demonstrates_the_proper_way_to_use_a_combat_action_tourniquet,_Nov._6,_2008_(081106-D-1852B-012).jpg", "license": "Public domain", "artist": "Fred W. Baker III", "licenseUrl": "", "credit": "Fred W. Baker III · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Tourniquet", "difficulty": 2, "reviewed": true}, {"subject": "Dental mirror", "answer": "מראת שיניים", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Mouth_mirror.JPG/500px-Mouth_mirror.JPG", "source": "https://commons.wikimedia.org/wiki/File:Mouth_mirror.JPG", "license": "CC BY-SA 4.0", "artist": "Daniela Tocan", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Daniela Tocan · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Mouth_mirror", "difficulty": 2, "reviewed": true}, {"subject": "Syringe pump", "answer": "משאבת מזרק", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Syringe_pump.jpg/500px-Syringe_pump.jpg", "source": "https://commons.wikimedia.org/wiki/File:Syringe_pump.jpg", "license": "CC BY-SA 2.5", "artist": "Nuno Nogueira ( Nmnogueira )", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5", "credit": "Nuno Nogueira ( Nmnogueira ) · CC BY-SA 2.5", "subjectSource": "https://en.wikipedia.org/wiki/Syringe_driver", "difficulty": 2, "reviewed": true}, {"subject": "Graduated cylinder", "answer": "משורה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Different_types_of_graduated_cylinder-_10ml%2C_25ml%2C_50ml_and_100_ml_graduated_cylinder.jpg/500px-Different_types_of_graduated_cylinder-_10ml%2C_25ml%2C_50ml_and_100_ml_graduated_cylinder.jpg", "source": "https://commons.wikimedia.org/wiki/File:Different_types_of_graduated_cylinder-_10ml,_25ml,_50ml_and_100_ml_graduated_cylinder.jpg", "license": "CC BY-SA 4.0", "artist": "Praphai Donphaimueang", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Praphai Donphaimueang · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Graduated_cylinder", "difficulty": 2, "reviewed": true}, {"subject": "Oxygen mask", "answer": "מסכת חמצן", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/Simple_face_mask.jpg/500px-Simple_face_mask.jpg", "source": "https://commons.wikimedia.org/wiki/File:Simple_face_mask.jpg", "license": "CC BY-SA 4.0", "artist": "James Heilman, MD", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "James Heilman, MD · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Oxygen_mask", "difficulty": 2, "reviewed": true}, {"subject": "Separatory funnel", "answer": "משפך מפריד", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Scheidetrichter_zwei_Phasen_brauner_Hintergrund.png/500px-Scheidetrichter_zwei_Phasen_brauner_Hintergrund.png", "source": "https://commons.wikimedia.org/wiki/File:Scheidetrichter_zwei_Phasen_brauner_Hintergrund.png", "license": "CC BY-SA 4.0", "artist": "HaJo88", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "HaJo88 · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Separatory_funnel", "difficulty": 2, "reviewed": true}, {"subject": "Centrifuge", "answer": "צנטריפוגה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0d/Tabletop_centrifuge.jpg/500px-Tabletop_centrifuge.jpg", "source": "https://commons.wikimedia.org/wiki/File:Tabletop_centrifuge.jpg", "license": "CC BY 1.0", "artist": "Magnus Manske", "licenseUrl": "https://creativecommons.org/licenses/by/1.0", "credit": "Magnus Manske · CC BY 1.0", "subjectSource": "https://en.wikipedia.org/wiki/Centrifuge", "difficulty": 2, "reviewed": true}, {"subject": "Test tube rack", "answer": "מעמד מבחנות", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Metal_tube_rack-laboratory_2.jpg/500px-Metal_tube_rack-laboratory_2.jpg", "source": "https://commons.wikimedia.org/wiki/File:Metal_tube_rack-laboratory_2.jpg", "license": "CC BY-SA 3.0", "artist": "real name: Nadina Wiórkiewicz \n pl.wiki:  Nadine90  \n commons:  Nadine90", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "real name: Nadina Wiórkiewicz \n pl.wiki:  Nadine90  \n commons:  Nadine90 · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Test_tube_rack", "difficulty": 2, "reviewed": true}, {"subject": "Tongue depressor", "answer": "מקל לבדיקת גרון", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Mundspatel.jpg/500px-Mundspatel.jpg", "source": "https://commons.wikimedia.org/wiki/File:Mundspatel.jpg", "license": "CC BY-SA 3.0", "artist": "Welleschik", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "Welleschik · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Tongue_depressor", "difficulty": 2, "reviewed": true}, {"subject": "Volumetric flask", "answer": "בקבוק מדידה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Brand_volumetric_flask_100ml.jpg/500px-Brand_volumetric_flask_100ml.jpg", "source": "https://commons.wikimedia.org/wiki/File:Brand_volumetric_flask_100ml.jpg", "license": "CC BY-SA 3.0", "artist": "Lucasbosch", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "Lucasbosch · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Volumetric_flask", "difficulty": 2, "reviewed": true}, {"subject": "Toothbrush", "answer": "מברשת שיניים", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Toothbrush_20050716_004.jpg/500px-Toothbrush_20050716_004.jpg", "source": "https://commons.wikimedia.org/wiki/File:Toothbrush_20050716_004.jpg", "license": "Public domain", "artist": "Jonas Bergsten", "licenseUrl": "", "credit": "Jonas Bergsten · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Toothbrush", "difficulty": 2, "reviewed": true}, {"subject": "Erlenmeyer flask", "answer": "בקבוק ארלנמייר", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/250_mL_Erlenmeyer_flask.jpg/500px-250_mL_Erlenmeyer_flask.jpg", "source": "https://commons.wikimedia.org/wiki/File:250_mL_Erlenmeyer_flask.jpg", "license": "CC BY-SA 4.0", "artist": "Pilarbini", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Pilarbini · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Erlenmeyer_flask", "difficulty": 2, "reviewed": true}, {"subject": "Infusion pump", "answer": "משאבת עירוי", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Infusionspumpe.JPG/500px-Infusionspumpe.JPG", "source": "https://commons.wikimedia.org/wiki/File:Infusionspumpe.JPG", "license": "CC BY-SA 3.0", "artist": "Pflegewiki-User Würfel", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "credit": "Pflegewiki-User Würfel · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Infusion_pump", "difficulty": 2, "reviewed": true}, {"subject": "Bunsen burner", "answer": "מבער בונזן", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Mechero_Bunsen.jpg/500px-Mechero_Bunsen.jpg", "source": "https://commons.wikimedia.org/wiki/File:Mechero_Bunsen.jpg", "license": "CC BY 4.0", "artist": "Amfeli", "licenseUrl": "https://creativecommons.org/licenses/by/4.0", "credit": "Amfeli · CC BY 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Bunsen_burner", "difficulty": 2, "reviewed": true}, {"subject": "Wash bottle", "answer": "בקבוק שטיפה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/Lab_wash-bottles_water_EtOH.jpg/500px-Lab_wash-bottles_water_EtOH.jpg", "source": "https://commons.wikimedia.org/wiki/File:Lab_wash-bottles_water_EtOH.jpg", "license": "Public domain", "artist": "Masur", "licenseUrl": "", "credit": "Masur · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Wash_bottle", "difficulty": 2, "reviewed": true}, {"subject": "Sphygmomanometer", "answer": "מד לחץ דם", "aliases": ["מכשיר לחץ דם"], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Sphygmomanometer%26Cuff.JPG/500px-Sphygmomanometer%26Cuff.JPG", "source": "https://commons.wikimedia.org/wiki/File:Sphygmomanometer%26Cuff.JPG", "license": "Public domain", "artist": "ML5  at  English Wikipedia", "licenseUrl": "", "credit": "ML5  at  English Wikipedia · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Sphygmomanometer", "difficulty": 2, "reviewed": true}, {"subject": "Medical thermometer", "answer": "מדחום", "aliases": ["מדחום רפואי", "טרמומטר"], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Fieberthermometer_BW_2.JPG/500px-Fieberthermometer_BW_2.JPG", "source": "https://commons.wikimedia.org/wiki/File:Fieberthermometer_BW_2.JPG", "license": "CC BY-SA 3.0", "artist": "Berthold Werner", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "Berthold Werner · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Medical_thermometer", "difficulty": 2, "reviewed": true}, {"subject": "Automated external defibrillator", "answer": "דפיברילטור", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/AED_machine_medisource.jpg/500px-AED_machine_medisource.jpg", "source": "https://commons.wikimedia.org/wiki/File:AED_machine_medisource.jpg", "license": "CC0", "artist": "Chercher1105", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "credit": "Chercher1105 · CC0", "subjectSource": "https://en.wikipedia.org/wiki/Automated_external_defibrillator", "difficulty": 2, "reviewed": true}, {"subject": "Retainer (orthodontics)", "answer": "פלטה לשיניים", "aliases": ["פלטה אורתודונטית", "קיבוע נשלף לשיניים"], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/Retainer.jpg/500px-Retainer.jpg", "source": "https://commons.wikimedia.org/wiki/File:Retainer.jpg", "license": "CC BY-SA 4.0", "artist": "Hondur", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Hondur · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Retainer_%28orthodontics%29", "difficulty": 2, "reviewed": true}, {"subject": "Denture", "answer": "שיניים תותבות", "aliases": [], "image": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Mr_M%27s_Complete_Denture2.jpg", "source": "https://commons.wikimedia.org/wiki/File:Mr_M%27s_Complete_Denture2.jpg", "license": "Public domain", "artist": "No machine-readable author provided.  Eddau~commonswiki  assumed (based on copyright claims).", "licenseUrl": "", "credit": "No machine-readable author provided.  Eddau~commonswiki  assumed (based on copyright claims). · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Dentures", "difficulty": 2, "reviewed": true}], "photo-kitchen": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Chapaticooking.jpg/960px-Chapaticooking.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מערוך", "aliases": [], "difficulty": 4, "credit": "Alena · CC BY 2.0 · https://www.flickr.com/photos/alanaeadelino/379004738/sizes/l/", "source": "https://commons.wikimedia.org/wiki/File:Chapaticooking.jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "Alena", "subjectSource": "https://en.wikipedia.org/wiki/Rolling_pin", "subjectTitle": "Rolling pin", "imageDescription": "Preparation of chapati", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Greek_-_Ladle_-_Walters_57909.jpg/960px-Greek_-_Ladle_-_Walters_57909.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מצקת", "aliases": [], "difficulty": 4, "credit": "Anonymous  (  Greece  ) Unknown author · Public domain · Walters Art Museum : Home page Info about artwork", "source": "https://commons.wikimedia.org/wiki/File:Greek_-_Ladle_-_Walters_57909.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Anonymous  (  Greece  ) Unknown author", "subjectSource": "https://en.wikipedia.org/wiki/Ladle_(spoon)", "subjectTitle": "Ladle (spoon)", "imageDescription": "Ladles in the Classical and Hellenistic periods had handles that rose nearly vertically, as they were used for dipping into deep wine containers, such as \"kraters.\" Ladles were often paired with strainers, and this example's long, strap-like handle ends in the bent neck of a swan, matching the handles of the strainer, with which it was found.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/H%C3%A5lslev.JPG/960px-H%C3%A5lslev.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כף מחוררת", "aliases": [], "difficulty": 4, "credit": "Dnor · Public domain", "source": "https://commons.wikimedia.org/wiki/File:H%C3%A5lslev.JPG", "license": "Public domain", "licenseUrl": "", "artist": "Dnor", "subjectSource": "https://en.wikipedia.org/wiki/Skimmer_(utensil)", "subjectTitle": "Skimmer (utensil)", "imageDescription": "??", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Un_appareil_%C3%A9lectrique_%C3%A0_gaufres_en_France_en_d%C3%A9cembre_2021.jpg/960px-Un_appareil_%C3%A9lectrique_%C3%A0_gaufres_en_France_en_d%C3%A9cembre_2021.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מכשיר ופל", "aliases": [], "difficulty": 4, "credit": "Benoît Prieur · CC0", "source": "https://commons.wikimedia.org/wiki/File:Un_appareil_%C3%A9lectrique_%C3%A0_gaufres_en_France_en_d%C3%A9cembre_2021.jpg", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "artist": "Benoît Prieur", "subjectSource": "https://en.wikipedia.org/wiki/Waffle_iron", "subjectTitle": "Waffle iron", "imageDescription": "Un appareil électrique à gaufres en France en décembre 2021. Au second plan, un grille-pain.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Handheld_Electric_Beater.jpg/960px-Handheld_Electric_Beater.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מערבל ידני", "aliases": [], "difficulty": 4, "credit": "Donovan Govan. · CC BY-SA 3.0 · Image taken by me using a Canon PowerShot G3 (reference 7877).", "source": "https://commons.wikimedia.org/wiki/File:Handheld_Electric_Beater.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Donovan Govan.", "subjectSource": "https://en.wikipedia.org/wiki/Mixer_(appliance)", "subjectTitle": "Mixer (appliance)", "imageDescription": "This is a hand-held electric beater (also known as a hand-held electric mixer).", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/d/d6/Rice_Cooker_1.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "סיר אורז", "aliases": [], "difficulty": 4, "credit": "Quiet Hut · CC BY 2.0 · https://www.flickr.com/photos/quiethut/40330518981/", "source": "https://commons.wikimedia.org/wiki/File:Rice_Cooker_1.png", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "Quiet Hut", "subjectSource": "https://en.wikipedia.org/wiki/Rice_cooker", "subjectTitle": "Rice cooker", "imageDescription": "quiethut.com\n You are free to:\nShare — copy and redistribute the material in any medium or format\n    \nAdapt — remix, transform, and build upon the material for any purpose, even commercially.\n    \n \nYou must give appropriate credit and provide a link to quiethut.com or to the original post: quiethut.com/zojirushi-rice-cooker", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Crock_pot.jpg/960px-Crock_pot.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סיר לבישול איטי", "aliases": [], "difficulty": 4, "credit": "Janine  from Mililani, Hawaii, United States · CC BY 2.0 · crock pot Uploaded by Fæ", "source": "https://commons.wikimedia.org/wiki/File:Crock_pot.jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "Janine  from Mililani, Hawaii, United States", "subjectSource": "https://en.wikipedia.org/wiki/Slow_cooker", "subjectTitle": "Slow cooker", "imageDescription": "6-quart crock pot", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Eierschneider.jpg/960px-Eierschneider.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "פורס ביצים", "aliases": [], "difficulty": 4, "credit": "de:user:Rainer Zenz · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Eierschneider.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "de:user:Rainer Zenz", "subjectSource": "https://en.wikipedia.org/wiki/Egg_slicer", "subjectTitle": "Egg slicer", "imageDescription": "Eierschneider", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/Butter_dish.jpg/960px-Butter_dish.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כלי לחמאה", "aliases": [], "difficulty": 4, "credit": "The Digital Pimp · CC BY 2.0 · I'm officially an adult. I have a butter dish. Uploaded by ArielGlenn", "source": "https://commons.wikimedia.org/wiki/File:Butter_dish.jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "The Digital Pimp", "subjectSource": "https://en.wikipedia.org/wiki/Butter_dish", "subjectTitle": "Butter dish", "imageDescription": "I'm officially an adult. I have a butter dish.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Breadbox.jpg/960px-Breadbox.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "ארגז לחם", "aliases": [], "difficulty": 4, "credit": "No machine-readable author provided.  Owen  assumed (based on copyright claims). · Public domain · No machine-readable source provided. Own work assumed (based on copyright claims).", "source": "https://commons.wikimedia.org/wiki/File:Breadbox.jpg", "license": "Public domain", "licenseUrl": "", "artist": "No machine-readable author provided.  Owen  assumed (based on copyright claims).", "subjectSource": "https://en.wikipedia.org/wiki/Breadbox", "subjectTitle": "Breadbox", "imageDescription": "", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Soup_Spoon.jpg/960px-Soup_Spoon.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כף", "aliases": [], "difficulty": 4, "credit": "Donovan Govan. · CC BY-SA 3.0 · Image taken by me using a Canon PowerShot G3 (reference 7867).", "source": "https://commons.wikimedia.org/wiki/File:Soup_Spoon.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Donovan Govan.", "subjectSource": "https://en.wikipedia.org/wiki/Spoon", "subjectTitle": "Spoon", "imageDescription": "Un exemple d'arme : la cuillère", "reviewed": true}], "photo-celebrations": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Classic_Hanukkah_sufganiyot.JPG/960px-Classic_Hanukkah_sufganiyot.JPG", "answer": "סופגנייה", "aliases": ["סופגניה"], "difficulty": 2, "credit": "Noam Furer · CC0", "source": "https://commons.wikimedia.org/wiki/File:Classic_Hanukkah_sufganiyot.JPG", "artist": "Noam Furer", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/LatkeFry.JPG/960px-LatkeFry.JPG", "answer": "לביבה", "aliases": [], "difficulty": 4, "credit": "Jonathunder · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:LatkeFry.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Jonathunder", "subjectSource": "https://en.wikipedia.org/wiki/Latke", "subjectTitle": "Latke", "imageDescription": "Potato latke made from Manischewitz brand mix frying in hot olive oil.", "reviewed": true}], "photo-instruments": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/A_converter_free-bass_piano-accordion_and_a_Russian_bayan.jpg/960px-A_converter_free-bass_piano-accordion_and_a_Russian_bayan.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "אקורדיון", "aliases": [], "difficulty": 4, "credit": "Necz0r · CC BY-SA 3.0 · Henry Doktorski", "source": "https://commons.wikimedia.org/wiki/File:A_converter_free-bass_piano-accordion_and_a_Russian_bayan.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Necz0r", "subjectSource": "https://en.wikipedia.org/wiki/Accordion", "subjectTitle": "Accordion", "imageDescription": "Piano-Accordion: 140-bass convertor/free-bass Model Emperor concert accordion built by Victoria company of Castelfidardo, Italy in 1978, owned and photographed by Henry Doktorski \n Russian Bayan Accordion built in the U.S.S.R. by Jupiter Company. Instrument from the collection of A World of Accordions Museum in Superior, Wisconsin, USA. Photographed by  Henrydoktorski ,  Henry Doktorski .", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Eight_saxophone_sizes_smaller.png/960px-Eight_saxophone_sizes_smaller.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סקסופון", "aliases": [], "difficulty": 4, "credit": "Jonathanischoice · CC BY 4.0 · Own work ; composite of File:Eppelsheim Soprillo Saxophone 2000s.jpg , File:Orsi Sopranino Saxophone.jpg , File:4 Saxophone Amati white background.jpg , File:WANZ Instrument 2024-09 IMG 7848 bass saxophone.png , File:Orsi Contrabass Saxophone (1999).jpg", "source": "https://commons.wikimedia.org/wiki/File:Eight_saxophone_sizes_smaller.png", "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0", "artist": "Jonathanischoice", "subjectSource": "https://en.wikipedia.org/wiki/Saxophone", "subjectTitle": "Saxophone", "imageDescription": "The extended saxophone family, in eight sizes from piccolo to contrabass. Left to right: soprillo (piccolo in B♭) by Eppelsheim, Munich; sopranino in E♭ by Romeo Orsi, Milan; soprano in B♭, alto in E♭, tenor in B♭, and baritone in E♭ (to low A) by Amati Kraslice; bass in B♭ by Henri Selmer, Paris; contrabass in E♭ by Romeo Orsi, Milan (210 cm); subcontrabass in B♭ not shown (J'Élle Stainer model measures 274 cm).", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Leitner%2BKraus_410_320.png/960px-Leitner%2BKraus_410_320.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קלרינט", "aliases": [], "difficulty": 4, "credit": "Leitner & Kraus GmbH, Neustadt/Aisch, Editor/Bearbeiter  User:Gisbert K · CC BY-SA 4.0 · ", "source": "https://commons.wikimedia.org/wiki/File:Leitner%2BKraus_410_320.png", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Leitner & Kraus GmbH, Neustadt/Aisch, Editor/Bearbeiter  User:Gisbert K", "subjectSource": "https://en.wikipedia.org/wiki/Clarinet", "subjectTitle": "Clarinet", "imageDescription": "Summary of the two released images Leitner + Kraus 410.jpg and Leitner + Kraus 320.jpg", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Yamaha_Tenor_trombone_YSL-891Z_%28re-crop%29.jpg/960px-Yamaha_Tenor_trombone_YSL-891Z_%28re-crop%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "טרומבון", "aliases": [], "difficulty": 4, "credit": "Yamaha Corporation · CC BY-SA 4.0 · JPEG format conversion and un-crop of the CC-By-SA-licensed Commons TIFF image, File:Yamaha Tenor trombone YSL-891Z.tif", "source": "https://commons.wikimedia.org/wiki/File:Yamaha_Tenor_trombone_YSL-891Z_(re-crop).jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Yamaha Corporation", "subjectSource": "https://en.wikipedia.org/wiki/Trombone", "subjectTitle": "Trombone", "imageDescription": "Yamaha tenor trombone in B♭, model YSL-891Z. This is a re-crop of  File:Yamaha Tenor trombone YSL-891Z.tif  made to satisfy criteria for Page Preview card images, for use with Wikipedia trombone articles.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/Mandolin_MET_DP169023_%282%29.jpg/960px-Mandolin_MET_DP169023_%282%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מנדולינה", "aliases": [], "difficulty": 4, "credit": "Angelo Mannello · CC0 · ", "source": "https://commons.wikimedia.org/wiki/File:Mandolin_MET_DP169023_(2).jpg", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "artist": "Angelo Mannello", "subjectSource": "https://en.wikipedia.org/wiki/Mandolin", "subjectTitle": "Mandolin", "imageDescription": "Мандолина примерно 1900 года.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Scotland_Independence_March%2C_28_March_2026_%2832%29.jpg/960px-Scotland_Independence_March%2C_28_March_2026_%2832%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חמת חלילים", "aliases": [], "difficulty": 4, "credit": "Lucas Kendall · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Scotland_Independence_March,_28_March_2026_(32).jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Lucas Kendall", "subjectSource": "https://en.wikipedia.org/wiki/Bagpipes", "subjectTitle": "Bagpipes", "imageDescription": "On 28 March 2026, a march was in Edinburgh to Holyrood in support of Scottish independence.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Australiandidgeridoos.jpg/960px-Australiandidgeridoos.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "דידג׳רידו", "aliases": [], "difficulty": 4, "credit": "Hmarin · Public domain · Self-made image, from photos of my didgeridoo collection", "source": "https://commons.wikimedia.org/wiki/File:Australiandidgeridoos.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Hmarin", "subjectSource": "https://en.wikipedia.org/wiki/Didgeridoo", "subjectTitle": "Didgeridoo", "imageDescription": "Examples of modern Australian Didgeridoos \n  This photo illustrates some of the modern types of Eucalyptus didgeridoos in Australia. All of these instruments were naturally hollowed-out by termites. The didgeridoos shown here are from my collection, and range from authentic/traditional instruments, to didgeridoos made for tourist trade, to non-Aboriginal didgeridoos.\n   A:  Authentic, traditional Aboriginal didgeridoo (also called yidaki or mandapul), harvested, crafted and decorated by Aboriginals in northeastern Arnhemland, Northern Territory, who are the traditional custodians of the didgeridoo. (Made by Winiwini Larry Gurruwiwi of the Galpu clan.) I purchased this instrument from Larry through a broker.\n   B:  Authentic, traditional Aboriginal didgeridoo (also called yidaki or mandapul), harvested, crafted and decorated by Aboriginals in northeastern Arnhemland, Northern Territory, who are the traditional custodians of the didgeridoo. (Made by Djalu’ Gurruwiwi of the Galpu clan.) I personally picked out this instrument in Yirrkala, Northern Territory.\n   C:  Authentic, traditional Aboriginal didgeridoo (also called mago), harvested, crafted and decorated by Aboriginals in northeastern Arnhemland, Northern Territory, who are the traditional custodians of the didgeridoo. (Made by Dhugurun Gulungurr of the Ritharrngu clan.) I purchased this instrument through a broker.\n   D:  Non-traditional Aboriginal didgeridoo made for tourist trade in Queensland. \"Tourist didgeridoos\" such as this instrument may have actually been harvested and crafted by non-Aboriginals. The history of this instrument in that regard is unknown. This particular instrument was ultimately decorated by Aboriginals who are not traditional custodians of the didgeridoo. I purchased this didgeridoo in a Aboriginal-operated store in Queensland.\n \n E:  Australian didgeridoo, a very fine instrument that was harvested and crafted by non-Aboriginals in Australia. Non-Aboriginal didgeridoos should not be decorated with icons, patterns or colors that resemble Aboriginal decorations, out of respect for their cultural integrity. I personally picked out this instrument in Cairns, Queensland.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/6/60/Lenke_djembe_from_Mali.jpeg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "ג׳מבה", "aliases": [], "difficulty": 4, "credit": "Djembe Art · CC BY-SA 3.0 · Transferred from de.wikipedia to Commons by MichiHenning using CommonsHelper .", "source": "https://commons.wikimedia.org/wiki/File:Lenke_djembe_from_Mali.jpeg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Djembe Art", "subjectSource": "https://en.wikipedia.org/wiki/Djembe", "subjectTitle": "Djembe", "imageDescription": "Djembé aus Lenké-Holz", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/c/c0/Ene_mbira.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "קלימבה", "aliases": [], "difficulty": 4, "credit": "Zanzambira  at  English Wikipedia · Public domain · Transferred from en.wikipedia to Commons.", "source": "https://commons.wikimedia.org/wiki/File:Ene_mbira.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Zanzambira  at  English Wikipedia", "subjectSource": "https://en.wikipedia.org/wiki/Mbira", "subjectTitle": "Mbira", "imageDescription": "Mbira Dza Vadzimu \"Kanuchi\" by Fradreck Mujuru", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Steelpan_Instruments_at_Trinidad_and_Tobago_Carnival.jpg/960px-Steelpan_Instruments_at_Trinidad_and_Tobago_Carnival.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "תוף פלדה", "aliases": [], "difficulty": 4, "credit": "Kip1234 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Steelpan_Instruments_at_Trinidad_and_Tobago_Carnival.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Kip1234", "subjectSource": "https://en.wikipedia.org/wiki/Steelpan", "subjectTitle": "Steelpan", "imageDescription": "Steelpan Instruments at Trinidad and Tobago Carnival", "reviewed": true}], "photo-bugs": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Colorado_potato_beetle.jpg/960px-Colorado_potato_beetle.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חיפושית תפוחי אדמה", "aliases": ["חיפושית קולורדו"], "difficulty": 4, "credit": "Scott Bauer, USDA ARS · Public domain · This image was released by the Agricultural Research Service , the research agency of the United States Department of Agriculture , with the ID k4978-5 (next) .", "source": "https://commons.wikimedia.org/wiki/File:Colorado_potato_beetle.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Scott Bauer, USDA ARS", "subjectSource": "https://en.wikipedia.org/wiki/Colorado_potato_beetle", "subjectTitle": "Colorado potato beetle", "imageDescription": "A  Colorado potato beetle .", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Dynastinae.jpg/960px-Dynastinae.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חיפושית קרנף", "aliases": [], "difficulty": 4, "credit": "Anaxibia · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Dynastinae.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Anaxibia", "subjectSource": "https://en.wikipedia.org/wiki/Dynastinae", "subjectTitle": "Dynastinae", "imageDescription": "Dynastinae", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Bed_bug%2C_Cimex_lectularius.jpg/960px-Bed_bug%2C_Cimex_lectularius.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "פשפש מיטה", "aliases": [], "difficulty": 4, "credit": "Content Providers(s): CDC/ Harvard University, Dr. Gary Alpert; Dr. Harold Harlan; Richard Pollack. Photo Credit: Piotr Naskrecki · Public domain · http://phil.cdc.gov/phil/details.asp?pid=9822", "source": "https://commons.wikimedia.org/wiki/File:Bed_bug,_Cimex_lectularius.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Content Providers(s): CDC/ Harvard University, Dr. Gary Alpert; Dr. Harold Harlan; Richard Pollack. Photo Credit: Piotr Naskrecki", "subjectSource": "https://en.wikipedia.org/wiki/Bed_bug", "subjectTitle": "Bed bug", "imageDescription": "This 2006 photograph depicted an oblique-dorsal view of a  bed bug nymph  ( Cimex lectularius ) as it was in the process of ingesting a blood meal from the arm of a “voluntary” human host.\n Bed bugs are not vectors in nature of any known human disease. Although some disease organisms have been recovered from bed bugs under laboratory conditions, none have been shown to be transmitted by bed bugs outside of the laboratory.\n  The common bed bug is found worldwide. Infestations are common in the developing world, occurring in settings of unsanitary living conditions and severe crowding. In North America and Western Europe, bed bug infestations became rare during the second half of the 20th century and have been viewed as a condition that occurs in travelers returning from developing countries. However, anecdotal reports suggest that bed bugs are increasingly common in the United States, Canada, and the United Kingdom.\n   C. lectularius  inject saliva into the blood stream of their host to thin the blood, and to prevent coagulation. It is this saliva that causes the intense itching and welts. The delay in the onset of itching gives the feeding bed bug time to escape into cracks and crevices. In some cases, the itchy bites can develop into painful welts that last several days.\n \nBed bug bites are difficult to diagnose due to the variability in bite response between people, and due to the change in skin reaction for the same person over time. It is best to collect and identify bed bugs to confirm bites. Bed bugs are responsible for loss of sleep, discomfort, disfiguring from numerous bites and occasionally bites may become infected.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/0/0d/Le_Caylar_fg01.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "מקלון", "aliases": [], "difficulty": 4, "credit": "Fritz Geller-Grimm  and Felix Grimm · CC BY-SA 2.5", "source": "https://commons.wikimedia.org/wiki/File:Le_Caylar_fg01.JPG", "license": "CC BY-SA 2.5", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5", "artist": "Fritz Geller-Grimm  and Felix Grimm", "subjectSource": "https://en.wikipedia.org/wiki/Phasmatodea", "subjectTitle": "Phasmatodea", "imageDescription": "Spanish Walking Stick ( Pijnackeria hispanica ), Le Caylar, Languedoc-Roussillon, France", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Phyllioidea_overview.jpg/960px-Phyllioidea_overview.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "עלעלית", "aliases": [], "difficulty": 4, "credit": "Drägü · CC BY 4.0", "source": "https://commons.wikimedia.org/wiki/File:Phyllioidea_overview.jpg", "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0", "artist": "Drägü", "subjectSource": "https://en.wikipedia.org/wiki/Phylliidae", "subjectTitle": "Phylliidae", "imageDescription": "Top row from left to right:  Phyllium ericoriai , female;  Walaphyllium monteithi , two females;  Phyllium mabantai  females\n Middle row from left to right:  Pulchriphyllium anangu , male;  Cryptophyllium westwoodii , female;  Phyllium letiranti , pair;  Phyllium jacobsoni , pair\n \nBottom row from left to right:  Nanophyllium  sp. male from Mokndoma;  Pulchriphyllium pulchrifolium , pair;  Chitoniscus  sp. female from  Suva", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/Velvet_ants_-_female_-_various_Dasymutilla.jpg/960px-Velvet_ants_-_female_-_various_Dasymutilla.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "צרעת קטיפה", "aliases": [], "difficulty": 4, "credit": "Jengod · CC BY-SA 4.0 · File:Velvetant.JPG File:Dasymutilla munifica.jpg File:Dasymutilla foxi imported from iNaturalist photo 314219566 on 19 November 2024.jpg File:Dasymutilla pseudopappus imported from iNaturalist photo 282056251 on 19 November 2024.jpg File:Dasymutilla scitula imported from iNaturalist photo 322348318 on 19 November 2024.jpg File:Dasymutilla gorgon imported from iNaturalist photo 200164065 on 19 November 2024.jpg", "source": "https://commons.wikimedia.org/wiki/File:Velvet_ants_-_female_-_various_Dasymutilla.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Jengod", "subjectSource": "https://en.wikipedia.org/wiki/Velvet_ant", "subjectTitle": "Velvet ant", "imageDescription": "Velvet ants - female - various Dasymutilla", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Common_house_fly%2C_Musca_domestica.jpg/960px-Common_house_fly%2C_Musca_domestica.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "זבוב הבית", "aliases": [], "difficulty": 4, "credit": "USDAgov · CC BY 2.0 · https://www.flickr.com/photos/usdagov/8674435033/sizes/o/in/photostream/", "source": "https://commons.wikimedia.org/wiki/File:Common_house_fly,_Musca_domestica.jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "USDAgov", "subjectSource": "https://en.wikipedia.org/wiki/Housefly", "subjectTitle": "Housefly", "imageDescription": "Common house fly, Musca domestica.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Red_grasshawk_%28Neurothemis_fluctuans%29_male_Phuket_2.jpg/960px-Red_grasshawk_%28Neurothemis_fluctuans%29_male_Phuket_2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "שפירית", "aliases": [], "difficulty": 4, "credit": "Charles J. Sharp · CC BY-SA 4.0 · Own work , from Sharp Photography, sharpphotography.co.uk", "source": "https://commons.wikimedia.org/wiki/File:Red_grasshawk_(Neurothemis_fluctuans)_male_Phuket_2.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Charles J. Sharp", "subjectSource": "https://en.wikipedia.org/wiki/Dragonfly", "subjectTitle": "Dragonfly", "imageDescription": "Red grasshawk ( Neurothemis fluctuans ) male, Chalong, Phuket, Thailand", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/f/fe/Scorpion_Photograph_By_Shantanu_Kuveskar.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "עקרב", "aliases": [], "difficulty": 4, "credit": "Shantanu Kuveskar · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Scorpion_Photograph_By_Shantanu_Kuveskar.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Shantanu Kuveskar", "subjectSource": "https://en.wikipedia.org/wiki/Scorpion", "subjectTitle": "Scorpion", "imageDescription": "Hottentotta tamulus, The Indian red scorpion from Mangaon, Maharashtra, India", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/c/c1/Chilopoda_collage.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "נדל", "aliases": [], "difficulty": 4, "credit": "Thomas Brown \n AfroBrazilian \n Warut Siriwut, Gregory D. Edgecombe, Chirasak Sutcharit, Piyoros Tongkerd, Somsak Panha \n Katja Schulz · CC BY-SA 4.0 · This file was derived from: Long-legged Centipede (Thereuopoda clunifera) (5827855550).jpg : Lithobius forficatus 03.JPG : Scolopendra cataracta from Zookeys.jpg : Soil Centipede Mother With Offspring (22684845147).jpg :", "source": "https://commons.wikimedia.org/wiki/File:Chilopoda_collage.png", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Thomas Brown \n AfroBrazilian \n Warut Siriwut, Gregory D. Edgecombe, Chirasak Sutcharit, Piyoros Tongkerd, Somsak Panha \n Katja Schulz", "subjectSource": "https://en.wikipedia.org/wiki/Centipede", "subjectTitle": "Centipede", "imageDescription": "A collage of chilopod myriapods a.k.a centipedes ( Arthropoda :  Myriapoda :   Chilopoda  ).\n  Top left:   Thereuopoda clunifera   ( Scutigeromorpha :  Scutigeridae ) \n Top right:   Lithobius melanops   ( Lithobiomorpha :  Lithobiidae ) \n Bottom left:   Scolopendra cataracta   ( Scolopendromorpha :  Scolopendridae ) \n Bottom right:   Geophilus   sp. ( Geophilomorpha :  Geophilidae ) (image rotated)", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Millipede_collage.jpg/960px-Millipede_collage.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "רב רגל", "aliases": [], "difficulty": 4, "credit": "Golovatch, S.; Mikhaljova, E.; Chang, H. Hedin, Marshal Ioannou, N.  VandenSpiegel, D., Golovatch, S. Chen, C.; Golovatch, S.; Chang, H. Joydeep Stoev, P.; Akkari, N.; Enghoff, H. Akkari, N. USGS Native Bee Inventory and Monitoring Laboratory\n \n Collage created by  Animalparty · CC BY 4.0", "source": "https://commons.wikimedia.org/wiki/File:Millipede_collage.jpg", "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0", "artist": "Golovatch, S.; Mikhaljova, E.; Chang, H. Hedin, Marshal Ioannou, N.  VandenSpiegel, D., Golovatch, S. Chen, C.; Golovatch, S.; Chang, H. Joydeep Stoev, P.; Akkari, N.; Enghoff, H. Akkari, N. USGS Native Bee Inventory and Monitoring Laboratory\n \n Collage created by  Animalparty", "subjectSource": "https://en.wikipedia.org/wiki/Millipede", "subjectTitle": "Millipede", "imageDescription": "An assortment of millipedes (class Diplopoda). Photographs not to scale. \n Top row:  Epanerchodus curtigonopus  (Polydesmida, Polydesmidae);  Brachycybe lecontii  (Platydesmida, Andrognathidae). \nSecond row:  Sagmatostreptus strongylopygus  (Spirostreptida, Spirostreptidae). \nThird row:  Ammodesmus granum  (Polydesmida, Ammodesmidae);  Aponedyopus montanus  (Polydesmida, Paradoxosomatidae);  Glomeris sublimbata  (Glomerida, Glomeridae) \nFourth row:   Titanophyllum spiliarum   (Julida, Julidae); Unknown species (Spirobolida) \n \nBottom: Unknown species (Julida, Nemasomatidae)", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Tachypleus_gigas.JPG/960px-Tachypleus_gigas.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סרטן פרסה", "aliases": [], "difficulty": 4, "credit": "Shubham Chatterjee · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Tachypleus_gigas.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Shubham Chatterjee", "subjectSource": "https://en.wikipedia.org/wiki/Horseshoe_crab", "subjectTitle": "Horseshoe crab", "imageDescription": "A female Indo-Pacific horseshoe crab, photographed in the West Bengal-Odisha coastal region on the Indian coastline of the Bay of Bengal. It was carried by a local fisher man from the seabed to the coast by mistake. This specimen was alive when photographed.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8e/Calliactis_and_Dardanus_001.JPG/960px-Calliactis_and_Dardanus_001.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סרטן נזיר", "aliases": [], "difficulty": 4, "credit": "H. Zell · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Calliactis_and_Dardanus_001.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "H. Zell", "subjectSource": "https://en.wikipedia.org/wiki/Hermit_crab", "subjectTitle": "Hermit crab", "imageDescription": "Dardanus calidus  , Diogenidae, Large Red Hermit Crab with  Calliactis parasitica , Hormathiidae, Hermit Anemone; Staatliches Museum für Naturkunde Karlsruhe, Germany. The Hermit Anemone is used in homeopathy as remedy: Calliactis parasitica (Callia-p.).", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Water_strider_%28Gerridae_sp.%29_Makiling.jpg/960px-Water_strider_%28Gerridae_sp.%29_Makiling.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מודד מים", "aliases": [], "difficulty": 4, "credit": "Charles J. Sharp · CC BY-SA 4.0 · Own work , from Sharp Photography, sharpphotography.co.uk", "source": "https://commons.wikimedia.org/wiki/File:Water_strider_(Gerridae_sp.)_Makiling.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Charles J. Sharp", "subjectSource": "https://en.wikipedia.org/wiki/Gerridae", "subjectTitle": "Gerridae", "imageDescription": "Water strider ( Gerridae sp. ), Makiling Botanic Garden, Luzon, Philippines", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Brachypelma_vagans_p1.jpg/960px-Brachypelma_vagans_p1.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "טרנטולה", "aliases": [], "difficulty": 4, "credit": "Carlos Valenzuela Montuy · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Brachypelma_vagans_p1.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Carlos Valenzuela Montuy", "subjectSource": "https://en.wikipedia.org/wiki/Tarantula", "subjectTitle": "Tarantula", "imageDescription": "Brachypelma vagans  (Mexican red rump tarantula), adult female", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Woodlouse_collage_x4.png/960px-Woodlouse_collage_x4.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "טחבית", "aliases": [], "difficulty": 4, "credit": "Collage:  User:Edit-pi  (collage), original authors: see source images. · CC BY-SA 4.0 · This file was derived from: Schizidium.jpg : Ligia oceanica.JPG : Platthyartrus hoffmansegi (2321100626).jpg : Hemilepistus reaumurii 03.JPG :", "source": "https://commons.wikimedia.org/wiki/File:Woodlouse_collage_x4.png", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Collage:  User:Edit-pi  (collage), original authors: see source images.", "subjectSource": "https://en.wikipedia.org/wiki/Woodlouse", "subjectTitle": "Woodlouse", "imageDescription": "Four species of woodlice illustrating the diversity of this isopod suborder. TOP LEFT: fully conglobated  Schizidium tiberianum , a fully terrestrial species. TOP RIGHT:  Ligia oceanica , a supra-littoral species. BOTTOM LEFT:  Platyarthrus hoffmannseggii , a commensal symbiont of ants (dug out of an ants' nest). BOTTOM RIGHT:  Hemilepistus reaumuri , a desert-dwelling species which digs burrows and forms social family groups.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Opiliones_harvestman.jpg/960px-Opiliones_harvestman.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קוצר", "aliases": [], "difficulty": 4, "credit": "Bruce Marlin · CC BY-SA 2.5 · Own work http://www.cirrusimage.com/harvestman.htm", "source": "https://commons.wikimedia.org/wiki/File:Opiliones_harvestman.jpg", "license": "CC BY-SA 2.5", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5", "artist": "Bruce Marlin", "subjectSource": "https://en.wikipedia.org/wiki/Opiliones", "subjectTitle": "Opiliones", "imageDescription": "jpeg image, male   Hadrobunus grandis  , Harvestman: Order Opiliones, Family Sclerosomatidae", "reviewed": true}], "photo-sea": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Holothuroidea_orders_collage.png/960px-Holothuroidea_orders_collage.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מלפפון ים", "aliases": [], "difficulty": 4, "credit": "Diego Delso    /    Diego Delso · CC BY-SA 4.0 · Own work made from the following Wikimedia free images (some cropped and/or rotated). From top to bottom and from left to right: Row 1: File:Sea Apple.jpg File:Pepino de mar (Thelenota ananas), mar Rojo, Egipto, 2023-04-17, DD 58.jpg File:Synapta maculata 62244486.jpg Row 2: File:Pepino de mar negro (Holothuria forskali), Parque natural de la Arrábida, Portugal, 2021-09-10, DD 59.jpg File:Expl5475.jpg Row 3: File:Caudina arenicola 264007697.jpg File:Molpadiodemas (10.3897-zookeys.1113.82172) Figure 36.jpg File:Palaeocucumaria hunsrueckiana Unt Devon Bundenbach Ec1695b.jpg", "source": "https://commons.wikimedia.org/wiki/File:Holothuroidea_orders_collage.png", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Diego Delso    /    Diego Delso", "subjectSource": "https://en.wikipedia.org/wiki/Sea_cucumber", "subjectTitle": "Sea cucumber", "imageDescription": "A composite image showcasing members of the 8 holothuroid orders accepted by WoRMS. From top to bottom and from left to right:\n Row 1:  Pseudocolochirus  sp. ( Dendrochirotida ),  Thelenota ananas  ( Synallactida ),  Synapta maculata  ( Apodida ),\n  Row 2:  Holothuria forskali  ( Holothuriida ),  Enypniastes  sp. ( Elasipodida ),\n \nRow 3:  Caudina arenicola  ( Molpadida ),  Molpadiodemas  stet. ( Persiculida ),  Palaeocucumaria hunsrueckiana  ( Arthrochirotida ).", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/Starfish_montage.png/960px-Starfish_montage.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כוכב ים", "aliases": [], "difficulty": 4, "credit": "Top left: Klaus Rassinger (Museum Wiesbaden)\nTop right: Katie Ahlfeld\nBottom right: Jon Zander (Digon3)\n \nBottom left: Espen Rekdal · CC BY-SA 4.0 · File:0059 Blauer Seestern.jpg – CC BY SA 4.0 File:Echinaster serpentarius (USNM E28192) 001.jpeg – CC 0 File:Horned Starfish Macro.JPG – CC BY SA 3.0 File:Hymenaster pellucidus 02 Espen Rekdal.jpg – CC BY 4.0", "source": "https://commons.wikimedia.org/wiki/File:Starfish_montage.png", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Top left: Klaus Rassinger (Museum Wiesbaden)\nTop right: Katie Ahlfeld\nBottom right: Jon Zander (Digon3)\n \nBottom left: Espen Rekdal", "subjectSource": "https://en.wikipedia.org/wiki/Starfish", "subjectTitle": "Starfish", "imageDescription": "Montage of various starfish species, on a black background.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/0/02/Sea_Otter_%28Enhydra_lutris%29_%2825169790524%29_crop.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "לוטרת ים", "aliases": [], "difficulty": 4, "credit": "Marshal Hedin  from San Diego · CC BY-SA 2.0 · Sea Otter (Enhydra lutris)", "source": "https://commons.wikimedia.org/wiki/File:Sea_Otter_(Enhydra_lutris)_(25169790524)_crop.jpg", "license": "CC BY-SA 2.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "artist": "Marshal Hedin  from San Diego", "subjectSource": "https://en.wikipedia.org/wiki/Sea_otter", "subjectTitle": "Sea otter", "imageDescription": "A close-up of a sea otter, taken in  Morro Bay, California  in 2016.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Heteroconger_hassi_1.JPG/960px-Heteroconger_hassi_1.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "צלופח גן", "aliases": [], "difficulty": 4, "credit": "Truth Seeker (fawiki) · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Heteroconger_hassi_1.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Truth Seeker (fawiki)", "subjectSource": "https://en.wikipedia.org/wiki/Heterocongrinae", "subjectTitle": "Heterocongrinae", "imageDescription": "Garden Eels in Dubai Aquarium. Garden eels with spots are  Heteroconger hassi  (both in foreground and background) and with stripes are  Gorgasia preclara  (background only)", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Berghia_coerulescens_%28Laurillard%2C_1830%29.jpg/960px-Berghia_coerulescens_%28Laurillard%2C_1830%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חשופית ים", "aliases": ["חשופית"], "difficulty": 4, "credit": "Géry PARENT · Public domain · Own work , cropped", "source": "https://commons.wikimedia.org/wiki/File:Berghia_coerulescens_(Laurillard,_1830).jpg", "license": "Public domain", "licenseUrl": "", "artist": "Géry PARENT", "subjectSource": "https://en.wikipedia.org/wiki/Nudibranch", "subjectTitle": "Nudibranch", "imageDescription": "Berghia coerulescens  (Laurillard, 1830) feeds  Aiptasia couchii  Cocks, 1851 - pers. obs. - Banyuls-sur-Mer : 07/1994", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Balistoides_conspicillum_2607.jpg/960px-Balistoides_conspicillum_2607.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "נצרן ליצן", "aliases": [], "difficulty": 4, "credit": "Amada44 · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Balistoides_conspicillum_2607.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Amada44", "subjectSource": "https://en.wikipedia.org/wiki/Clown_triggerfish", "subjectTitle": "Clown triggerfish", "imageDescription": "Balistoides conspicillum , Ushaka Sea world", "reviewed": true}], "photo-art": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Caran_d%27Ache%27s_NEOPASTEL_12_colors.jpg/960px-Caran_d%27Ache%27s_NEOPASTEL_12_colors.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "פסטל שמן", "aliases": [], "difficulty": 4, "credit": "Mk2010 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Caran_d%27Ache%27s_NEOPASTEL_12_colors.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Mk2010", "subjectSource": "https://en.wikipedia.org/wiki/Oil_pastel", "subjectTitle": "Oil pastel", "imageDescription": "Caran d'Ache NEOPASTEL 12 colors soft oil pastels", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Dolceacqua43_-_Artista_locale_mentre_dipinge_un_acquarello.jpg/960px-Dolceacqua43_-_Artista_locale_mentre_dipinge_un_acquarello.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "ציור בצבעי מים", "aliases": [], "difficulty": 4, "credit": "Dongio · Public domain", "source": "https://commons.wikimedia.org/wiki/File:Dolceacqua43_-_Artista_locale_mentre_dipinge_un_acquarello.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Dongio", "subjectSource": "https://en.wikipedia.org/wiki/Watercolor_painting", "subjectTitle": "Watercolor painting", "imageDescription": "A watercolor painter working in  Dolceacqua  (Liguria, Italy).", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/TeeshirtCopyleft_cadre.jpg/960px-TeeshirtCopyleft_cadre.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "הדפס רשת", "aliases": [], "difficulty": 4, "credit": "Meul ( Meul ) · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:TeeshirtCopyleft_cadre.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Meul ( Meul )", "subjectSource": "https://en.wikipedia.org/wiki/Screen_printing", "subjectTitle": "Screen printing", "imageDescription": "Home made screen for print copyleft tee-shirt.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Palette_and_painting_knives.jpg/960px-Palette_and_painting_knives.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סכין פלטה", "aliases": [], "difficulty": 4, "credit": "JohanahoJ · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Palette_and_painting_knives.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "JohanahoJ", "subjectSource": "https://en.wikipedia.org/wiki/Palette_knife", "subjectTitle": "Palette knife", "imageDescription": "Palette and painting knives", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Holt_Renfrew_Mannequins.jpg/960px-Holt_Renfrew_Mannequins.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "בובת תצוגה", "aliases": [], "difficulty": 4, "credit": "Colin Rose · CC BY 2.0 · Flickr", "source": "https://commons.wikimedia.org/wiki/File:Holt_Renfrew_Mannequins.jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "Colin Rose", "subjectSource": "https://en.wikipedia.org/wiki/Mannequin", "subjectTitle": "Mannequin", "imageDescription": "Mannequins at the Holt Renfrew store in Montreal, Canada Holt Renfrew", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Elderlyspinnera.jpg/960px-Elderlyspinnera.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "גלגל טווייה", "aliases": [], "difficulty": 4, "credit": "Detroit Publishing Co. · Public domain · Library of Congress REPRODUCTION NUMBER: LLC-DIG-ppmsc-09892", "source": "https://commons.wikimedia.org/wiki/File:Elderlyspinnera.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Detroit Publishing Co.", "subjectSource": "https://en.wikipedia.org/wiki/Spinning_wheel", "subjectTitle": "Spinning wheel", "imageDescription": "Photochrom print of an elderly Irish woman at a spinning wheel.\nNote: This is a posed nostalgia photograph, since the spinning wheel had gone out of use in almost all practical everyday contexts for a half-century or more by the time this picture was taken.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Verknipte_kantstrook.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "תחרה", "aliases": [], "difficulty": 4, "credit": "Carolus · CC BY 3.0", "source": "https://commons.wikimedia.org/wiki/File:Verknipte_kantstrook.JPG", "license": "CC BY 3.0", "licenseUrl": "https://creativecommons.org/licenses/by/3.0", "artist": "Carolus", "subjectSource": "https://en.wikipedia.org/wiki/Lace", "subjectTitle": "Lace", "imageDescription": "An example of old valuable framed lace for commercial use in  Brugge", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Quilter_and_quilting_in_the_Bazaar_of_Nishapur_11.JPG/960px-Quilter_and_quilting_in_the_Bazaar_of_Nishapur_11.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "שמיכת טלאים", "aliases": [], "difficulty": 4, "credit": "Sonia Sevilla · CC0", "source": "https://commons.wikimedia.org/wiki/File:Quilter_and_quilting_in_the_Bazaar_of_Nishapur_11.JPG", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "artist": "Sonia Sevilla", "subjectSource": "https://en.wikipedia.org/wiki/Quilting", "subjectTitle": "Quilting", "imageDescription": "Quilter and quilting in the Bazaar of Nishapur", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/2021-03-21_DSG0835_butterfly-shaped_handiwork_in_tatting_technique_%28high_resolution%29.jpg/960px-2021-03-21_DSG0835_butterfly-shaped_handiwork_in_tatting_technique_%28high_resolution%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "תחרת שאטל", "aliases": [], "difficulty": 4, "credit": "Franz van Duns · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:2021-03-21_DSG0835_butterfly-shaped_handiwork_in_tatting_technique_(high_resolution).jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Franz van Duns", "subjectSource": "https://en.wikipedia.org/wiki/Tatting", "subjectTitle": "Tatting", "imageDescription": "Butterfly-shaped handiwork created by means of the so called tatting technique. Every thread and knot is visible in exquisite detail. This very fine level of resolution was derived by merging 4 precursor images taken at sensor positions just one pixel apart.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/d/d9/Borduurring.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "חישוק רקמה", "aliases": [], "difficulty": 4, "credit": "Teunie  at  Dutch Wikipedia · CC BY-SA 3.0 · Transferred from nl.wikipedia to Commons.", "source": "https://commons.wikimedia.org/wiki/File:Borduurring.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Teunie  at  Dutch Wikipedia", "subjectSource": "https://en.wikipedia.org/wiki/Embroidery_hoops_and_frames", "subjectTitle": "Embroidery hoops and frames", "imageDescription": "Borduurwerk in een borduurring \n \n Borduurring", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Knitting_needles_2.jpg/960px-Knitting_needles_2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מסרגות", "aliases": [], "difficulty": 4, "credit": "redjar (Jared C. Benedict.) · CC BY-SA 2.0 · Flickr", "source": "https://commons.wikimedia.org/wiki/File:Knitting_needles_2.jpg", "license": "CC BY-SA 2.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "artist": "redjar (Jared C. Benedict.)", "subjectSource": "https://en.wikipedia.org/wiki/Knitting_needle", "subjectTitle": "Knitting needle", "imageDescription": "Bamboo knitting needles Knitting needles", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Klettnadelkissen.jpg/960px-Klettnadelkissen.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כרית סיכות", "aliases": [], "difficulty": 4, "credit": "SteveK · CC BY 3.0", "source": "https://commons.wikimedia.org/wiki/File:Klettnadelkissen.jpg", "license": "CC BY 3.0", "licenseUrl": "https://creativecommons.org/licenses/by/3.0", "artist": "SteveK", "subjectSource": "https://en.wikipedia.org/wiki/Pincushion", "subjectTitle": "Pincushion", "imageDescription": "A wrist-worn, manufactured pincushion with a Velcro strap.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/a/a4/Fingerhut.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "אצבעון", "aliases": [], "difficulty": 4, "credit": "Pavel Krok · CC BY-SA 2.5", "source": "https://commons.wikimedia.org/wiki/File:Fingerhut.jpg", "license": "CC BY-SA 2.5", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5", "artist": "Pavel Krok", "subjectSource": "https://en.wikipedia.org/wiki/Thimble", "subjectTitle": "Thimble", "imageDescription": "Thimble, Fingerhut", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Vintage_wooden_cylindrical_bobbin_.jpg/960px-Vintage_wooden_cylindrical_bobbin_.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סליל חוט", "aliases": [], "difficulty": 4, "credit": "CSFC2850 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Vintage_wooden_cylindrical_bobbin_.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "CSFC2850", "subjectSource": "https://en.wikipedia.org/wiki/Bobbin", "subjectTitle": "Bobbin", "imageDescription": "A vintage wooden drawing bobbin 16\" x 9\" currently used as decor", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/a/a7/Paper_cutter_1.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "גיליוטינת נייר", "aliases": [], "difficulty": 4, "credit": "Nathan nfm  at  English Wikipedia · CC BY-SA 3.0 · Transferred from en.wikipedia to Commons by Mendaliv using CommonsHelper .", "source": "https://commons.wikimedia.org/wiki/File:Paper_cutter_1.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Nathan nfm  at  English Wikipedia", "subjectSource": "https://en.wikipedia.org/wiki/Paper_cutter", "subjectTitle": "Paper cutter", "imageDescription": "made this myself", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/JacmelMardiGras.jpg/960px-JacmelMardiGras.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "עיסת נייר", "aliases": [], "difficulty": 4, "credit": "User:Doron · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:JacmelMardiGras.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "User:Doron", "subjectSource": "https://en.wikipedia.org/wiki/Papier-m%C3%A2ch%C3%A9", "subjectTitle": "Papier-mâché", "imageDescription": "Mardi Gras Papier-mâché masks being prepared, Jacmel, Haiti.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Embroidery_thread.jpg/960px-Embroidery_thread.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חוט רקמה", "aliases": [], "difficulty": 4, "credit": "PKM · CC BY 2.5", "source": "https://commons.wikimedia.org/wiki/File:Embroidery_thread.jpg", "license": "CC BY 2.5", "licenseUrl": "https://creativecommons.org/licenses/by/2.5", "artist": "PKM", "subjectSource": "https://en.wikipedia.org/wiki/Embroidery_thread", "subjectTitle": "Embroidery thread", "imageDescription": "Embroidery thread, left to right: No. 5 perle cotton (coton perlé), matte cotton tapestry yarn, tapestry wool, cotton stranded embroidery floss.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Seam_ripper.jpg/960px-Seam_ripper.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "פורם תפרים", "aliases": [], "difficulty": 4, "credit": "No machine-readable author provided.  Dmeranda  assumed (based on copyright claims). · CC BY-SA 3.0 · No machine-readable source provided. Own work assumed (based on copyright claims).", "source": "https://commons.wikimedia.org/wiki/File:Seam_ripper.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "No machine-readable author provided.  Dmeranda  assumed (based on copyright claims).", "subjectSource": "https://en.wikipedia.org/wiki/Seam_ripper", "subjectTitle": "Seam ripper", "imageDescription": "A closeup of the head of a  seam ripper , a sewing tool for cutting or removing stitches.  The blade edge, the longer of the two forked ends, is about 1cm long.  The length of the exposed metal end (shaft plus head) is about 3cm, at which it joins with the plastic handle.  The red spherical plastic ball at the end of the smaller of the forks is approximately 1.5mm in diameter.\n \nTaken with a Sony A100 camera using a Sony 2.8/100 Macro lens. Image has not been edited.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/A_depiction_of_needle.JPG/960px-A_depiction_of_needle.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מחט תפירה", "aliases": [], "difficulty": 4, "credit": "Thamizhpparithi Maari · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:A_depiction_of_needle.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Thamizhpparithi Maari", "subjectSource": "https://en.wikipedia.org/wiki/Sewing_needle", "subjectTitle": "Sewing needle", "imageDescription": "This media file was uploaded as a part of the   TamilWiki Media Contest  .", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/4/45/Beads.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "חרוז", "aliases": ["חרוזים"], "difficulty": 4, "credit": "user:pschemp · CC BY-SA 3.0 · own work, scan of actual beads", "source": "https://commons.wikimedia.org/wiki/File:Beads.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "user:pschemp", "subjectSource": "https://en.wikipedia.org/wiki/Bead", "subjectTitle": "Bead", "imageDescription": "Chevron bead and Indian glass bead strings", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Stanley-Hot-Glue-Gun-GR35K.jpg/960px-Stanley-Hot-Glue-Gun-GR35K.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "אקדח דבק", "aliases": [], "difficulty": 4, "credit": "Evan-Amos · Public domain", "source": "https://commons.wikimedia.org/wiki/File:Stanley-Hot-Glue-Gun-GR35K.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Evan-Amos", "subjectSource": "https://en.wikipedia.org/wiki/Hot-melt_adhesive", "subjectTitle": "Hot-melt adhesive", "imageDescription": "An inexpensive hot glue gun for hobbyists made by Stanley, model GR35K.", "reviewed": true}, {"subject": "Crayon", "answer": "צבע שעווה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Crayones_cera.jpg/500px-Crayones_cera.jpg", "source": "https://commons.wikimedia.org/wiki/File:Crayones_cera.jpg", "license": "Public domain", "artist": "Jorge Barrios", "licenseUrl": "", "credit": "Jorge Barrios · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Crayon", "difficulty": 2, "reviewed": true}], "photo-fruits": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Mangos_-_single_and_halved.jpg/960px-Mangos_-_single_and_halved.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מנגו", "aliases": ["מנגו"], "difficulty": 4, "credit": "Ivar Leidus · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Mangos_-_single_and_halved.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Ivar Leidus", "subjectSource": "https://en.wikipedia.org/wiki/Mango", "subjectTitle": "Mango", "imageDescription": "Mango fruits – single and halved. Grown in Brazil", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/%E0%B4%95%E0%B5%88%E0%B4%A4%E0%B4%9A%E0%B5%8D%E0%B4%9A%E0%B4%95%E0%B5%8D%E0%B4%95.jpg/960px-%E0%B4%95%E0%B5%88%E0%B4%A4%E0%B4%9A%E0%B5%8D%E0%B4%9A%E0%B4%95%E0%B5%8D%E0%B4%95.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "אננס", "aliases": [], "difficulty": 4, "credit": "Suniltg  at  Malayalam Wikipedia · CC BY 3.0 · Transferred from ml.wikipedia to Commons by sreejithk2000 .", "source": "https://commons.wikimedia.org/wiki/File:%E0%B4%95%E0%B5%88%E0%B4%A4%E0%B4%9A%E0%B5%8D%E0%B4%9A%E0%B4%95%E0%B5%8D%E0%B4%95.jpg", "license": "CC BY 3.0", "licenseUrl": "https://creativecommons.org/licenses/by/3.0", "artist": "Suniltg  at  Malayalam Wikipedia", "subjectSource": "https://en.wikipedia.org/wiki/Pineapple", "subjectTitle": "Pineapple", "imageDescription": "Unripe pineapple", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Plums_African_Rose_-_whole%2C_halved_and_slice.jpg/960px-Plums_African_Rose_-_whole%2C_halved_and_slice.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "שזיף", "aliases": [], "difficulty": 4, "credit": "Ivar Leidus · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Plums_African_Rose_-_whole,_halved_and_slice.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Ivar Leidus", "subjectSource": "https://en.wikipedia.org/wiki/Plum", "subjectTitle": "Plum", "imageDescription": "Plums 'African Rose' – whole, halved and a slice", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Ribes_nigrum_a1.JPG/960px-Ribes_nigrum_a1.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "דומדמנית שחורה", "aliases": [], "difficulty": 4, "credit": "Jerzy Opioła · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Ribes_nigrum_a1.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Jerzy Opioła", "subjectSource": "https://en.wikipedia.org/wiki/Blackcurrant", "subjectTitle": "Blackcurrant", "imageDescription": "Ribes nigrum  (pl. porzeczka czarna)", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Salak_%28Salacca_zalacca%29%2C_2015-05-17.jpg/960px-Salak_%28Salacca_zalacca%29%2C_2015-05-17.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סלאק", "aliases": [], "difficulty": 4, "credit": "Crisco 1492 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Salak_(Salacca_zalacca),_2015-05-17.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Crisco 1492", "subjectSource": "https://en.wikipedia.org/wiki/Salak", "subjectTitle": "Salak", "imageDescription": "Salak (Salacca zalacca), 2015-05-17. Salak pondoh cultivar. Focus stack of four images. Scale shows 1 cm (top) and 1 inch (bottom).", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Artocarpus_altilis_%28fruit%29.jpg/960px-Artocarpus_altilis_%28fruit%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "פרי הלחם", "aliases": [], "difficulty": 4, "credit": "Hans Hillewaert · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Artocarpus_altilis_(fruit).jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Hans Hillewaert", "subjectSource": "https://en.wikipedia.org/wiki/Breadfruit", "subjectTitle": "Breadfruit", "imageDescription": "Breadfruit at Tortuguero, Costa Rica", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Grapes%2C_Rostov-on-Don%2C_Russia.jpg/960px-Grapes%2C_Rostov-on-Don%2C_Russia.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "ענבים", "aliases": [], "difficulty": 4, "credit": "Vyacheslav Argenberg · CC BY 4.0", "source": "https://commons.wikimedia.org/wiki/File:Grapes,_Rostov-on-Don,_Russia.jpg", "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0", "artist": "Vyacheslav Argenberg", "subjectSource": "https://en.wikipedia.org/wiki/Grape", "subjectTitle": "Grape", "imageDescription": "Green grapes. Purple grapes. Rostov-on-Don, Russia.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Ackee_001.jpg/960px-Ackee_001.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "אקי", "aliases": [], "difficulty": 4, "credit": "Jerome Walker · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Ackee_001.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Jerome Walker", "subjectSource": "https://en.wikipedia.org/wiki/Ackee", "subjectTitle": "Ackee", "imageDescription": "Photo of closed Ackee ( Blighia sapida ) fruit on tree", "reviewed": true}, {"subject": "Avocado", "answer": "אבוקדו", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Persea_americana_fruit_2.JPG/500px-Persea_americana_fruit_2.JPG", "source": "https://commons.wikimedia.org/wiki/File:Persea_americana_fruit_2.JPG", "license": "CC BY-SA 3.0", "artist": "B.navez", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "B.navez · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Avocado", "difficulty": 2, "reviewed": true}], "photo-furniture": [{"subject": "Billiard table", "answer": "שולחן ביליארד", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/A_carom_table_in_Caf%C3%A9_Z%C3%A9phyr%2C_Paris%2C_France%2C_14_January_2007.jpg/960px-A_carom_table_in_Caf%C3%A9_Z%C3%A9phyr%2C_Paris%2C_France%2C_14_January_2007.jpg", "source": "https://commons.wikimedia.org/wiki/File:A_carom_table_in_Caf%C3%A9_Z%C3%A9phyr,_Paris,_France,_14_January_2007.jpg", "license": "CC BY-SA 3.0", "artist": "No machine-readable author provided.  David.Monniaux  assumed (based on copyright claims).", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "credit": "No machine-readable author provided.  David.Monniaux  assumed (based on copyright claims). · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Billiard_table", "difficulty": 3, "reviewed": true}], "photo-school": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Wood-clipboard.jpg/960px-Wood-clipboard.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "לוח עם תפס", "aliases": [], "difficulty": 4, "credit": "Evan-amos · Public domain", "source": "https://commons.wikimedia.org/wiki/File:Wood-clipboard.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Evan-amos", "subjectSource": "https://en.wikipedia.org/wiki/Clipboard", "subjectTitle": "Clipboard", "imageDescription": "A common clipboard.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Sliderule.PickettN902T.agr.jpg/960px-Sliderule.PickettN902T.agr.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "סרגל חישוב", "aliases": [], "difficulty": 4, "credit": "ArnoldReinhold · CC BY 2.5 · Own work (I took this picture of an artifact in my possession on February 3, 2006. The object itself is functional in nature, was created before 1970 and has no copyright notice, either on front or back.)", "source": "https://commons.wikimedia.org/wiki/File:Sliderule.PickettN902T.agr.jpg", "license": "CC BY 2.5", "licenseUrl": "https://creativecommons.org/licenses/by/2.5", "artist": "ArnoldReinhold", "subjectSource": "https://en.wikipedia.org/wiki/Slide_rule", "subjectTitle": "Slide rule", "imageDescription": "w:Slide rule , Pickett model N902-T simplex trig. This is a typical student model. The back has instructions for use and a table of fractional powers of 2, to the 64th, and their decimal equivalents.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/BuchstuetzenHunde.jpg/960px-BuchstuetzenHunde.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "תומך ספרים", "aliases": [], "difficulty": 4, "credit": "Mabit1 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:BuchstuetzenHunde.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Mabit1", "subjectSource": "https://en.wikipedia.org/wiki/Bookend", "subjectTitle": "Bookend", "imageDescription": "Buchstützen mit Hundemotiv", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/2023_Rozszywacz_%282%29.jpg/960px-2023_Rozszywacz_%282%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חולץ סיכות", "aliases": [], "difficulty": 4, "credit": "Jacek Halicki · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:2023_Rozszywacz_(2).jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Jacek Halicki", "subjectSource": "https://en.wikipedia.org/wiki/Staple_remover", "subjectTitle": "Staple remover", "imageDescription": "Staple remover", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Ink-jet_printer_inside-cartridges.jpg/960px-Ink-jet_printer_inside-cartridges.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מחסנית דיו למדפסת", "aliases": [], "difficulty": 4, "credit": "Julo · Public domain", "source": "https://commons.wikimedia.org/wiki/File:Ink-jet_printer_inside-cartridges.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Julo", "subjectSource": "https://en.wikipedia.org/wiki/Ink_cartridge", "subjectTitle": "Ink cartridge", "imageDescription": "Ink-jet printer (model hp deskjet 845c) inside: cartridges", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Chalkboard_eraser%2C_Waldorf_School%2C_East_Lexington_MA.jpg/960px-Chalkboard_eraser%2C_Waldorf_School%2C_East_Lexington_MA.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מחק לוח", "aliases": [], "difficulty": 4, "credit": "John Phelan · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Chalkboard_eraser,_Waldorf_School,_East_Lexington_MA.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "John Phelan", "subjectSource": "https://en.wikipedia.org/wiki/Chalkboard_eraser", "subjectTitle": "Chalkboard eraser", "imageDescription": "Chalkboard eraser, Waldorf School, East Lexington Massachusetts", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Censored_stamp.jpg/960px-Censored_stamp.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חותמת גומי", "aliases": [], "difficulty": 4, "credit": "Piotr  VaGla  Waglowski,  http://www.vagla.pl · Public domain", "source": "https://commons.wikimedia.org/wiki/File:Censored_stamp.jpg", "license": "Public domain", "licenseUrl": "", "artist": "Piotr  VaGla  Waglowski,  http://www.vagla.pl", "subjectSource": "https://en.wikipedia.org/wiki/Rubber_stamp", "subjectTitle": "Rubber stamp", "imageDescription": "\"Censored\" rubber stamp", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d0/Bakelite_letter_opener.jpg/960px-Bakelite_letter_opener.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "פותחן מכתבים", "aliases": [], "difficulty": 4, "credit": "Sarefo · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Bakelite_letter_opener.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Sarefo", "subjectSource": "https://en.wikipedia.org/wiki/Paper_knife", "subjectTitle": "Paper knife", "imageDescription": "Bakelite letter opener from Germany, probably around 1920.", "reviewed": true}], "photo-drinks": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/Batido_de_pi%C3%B1a.jpg/960px-Batido_de_pi%C3%B1a.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "מיץ אננס", "aliases": [], "difficulty": 4, "credit": "El Mono Español · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Batido_de_pi%C3%B1a.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "El Mono Español", "subjectSource": "https://en.wikipedia.org/wiki/Pineapple_juice", "subjectTitle": "Pineapple juice", "imageDescription": "Pineapple smoothie", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Ginger_beer_bottle_assortment.jpg/960px-Ginger_beer_bottle_assortment.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "בירת ג׳ינג׳ר", "aliases": [], "difficulty": 4, "credit": "Aatu Dorochenko · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Ginger_beer_bottle_assortment.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Aatu Dorochenko", "subjectSource": "https://en.wikipedia.org/wiki/Ginger_beer", "subjectTitle": "Ginger beer", "imageDescription": "Assortment of ginger beer bottles containing Moscow Herbal, Bundaberg, Aqua Monaco, Thomas Henry, Goldberg and Fever Tree bottles.", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/8/89/Chai_In_Sakora.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "צ׳אי מסאלה", "aliases": [], "difficulty": 4, "credit": "Dadhichbittu007 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Chai_In_Sakora.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Dadhichbittu007", "subjectSource": "https://en.wikipedia.org/wiki/Masala_chai", "subjectTitle": "Masala chai", "imageDescription": "Speciality is The Glass in which this masala Tea is poured.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Irish_coffee_glass.jpg/960px-Irish_coffee_glass.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "אייריש קופי", "aliases": [], "difficulty": 4, "credit": "jules / stone soup · CC BY 2.0 · irish coffee", "source": "https://commons.wikimedia.org/wiki/File:Irish_coffee_glass.jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "jules / stone soup", "subjectSource": "https://en.wikipedia.org/wiki/Irish_coffee", "subjectTitle": "Irish coffee", "imageDescription": "An Irish coffee.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Turkish_tea2.jpg/960px-Turkish_tea2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "תה טורקי", "aliases": [], "difficulty": 4, "credit": "henribergius · CC BY-SA 2.0 · https://www.flickr.com/photos/bergie/3468680402/in/photostream/", "source": "https://commons.wikimedia.org/wiki/File:Turkish_tea2.jpg", "license": "CC BY-SA 2.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "artist": "henribergius", "subjectSource": "https://en.wikipedia.org/wiki/Tea_in_Turkey", "subjectTitle": "Tea in Turkey", "imageDescription": "Turkish tea", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/e/e2/Absinthe-glass.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "אבסינת", "aliases": [], "difficulty": 4, "credit": "Eric Litton · CC BY-SA 2.5", "source": "https://commons.wikimedia.org/wiki/File:Absinthe-glass.jpg", "license": "CC BY-SA 2.5", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5", "artist": "Eric Litton", "subjectSource": "https://en.wikipedia.org/wiki/Absinthe", "subjectTitle": "Absinthe", "imageDescription": "A reservoir glass filled with a naturally colored verte absinthe (prior to the addition of water) next to an absinthe spoon.", "reviewed": true}, {"subject": "Dalgona coffee", "answer": "קפה דלגונה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Homemade_Dalgona_Coffee.jpg/500px-Homemade_Dalgona_Coffee.jpg", "source": "https://commons.wikimedia.org/wiki/File:Homemade_Dalgona_Coffee.jpg", "license": "CC BY-SA 4.0", "artist": "Wikieditkid", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "credit": "Wikieditkid · CC BY-SA 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Dalgona_coffee", "difficulty": 4, "reviewed": true}, {"subject": "Affogato", "answer": "אפוגטו", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/17/Vinoteca%2C_Smithfield%2C_London_%284485849609%29.jpg/500px-Vinoteca%2C_Smithfield%2C_London_%284485849609%29.jpg", "source": "https://commons.wikimedia.org/wiki/File:Vinoteca,_Smithfield,_London_(4485849609).jpg", "license": "CC BY-SA 2.0", "artist": "Ewan Munro  from London, UK", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "credit": "Ewan Munro  from London, UK · CC BY-SA 2.0", "subjectSource": "https://en.wikipedia.org/wiki/Affogato", "difficulty": 4, "reviewed": true}, {"subject": "Falooda", "answer": "פאלודה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Faluda.JPG/500px-Faluda.JPG", "source": "https://commons.wikimedia.org/wiki/File:Faluda.JPG", "license": "CC BY-SA 3.0", "artist": "Randhirreddy  at  English Wikipedia", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "Randhirreddy  at  English Wikipedia · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Falooda", "difficulty": 4, "reviewed": true}, {"subject": "Latte macchiato", "answer": "לאטה מקיאטו", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Latte_macchiato_with_coffee_beans.jpg/500px-Latte_macchiato_with_coffee_beans.jpg", "source": "https://commons.wikimedia.org/wiki/File:Latte_macchiato_with_coffee_beans.jpg", "license": "CC BY-SA 2.5", "artist": "א (Aleph)", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5", "credit": "א (Aleph) · CC BY-SA 2.5", "subjectSource": "https://en.wikipedia.org/wiki/Latte_macchiato", "difficulty": 4, "reviewed": true}, {"subject": "Black and tan", "answer": "בלאק אנד טאן", "aliases": ["בלאק וטאן"], "image": "https://upload.wikimedia.org/wikipedia/commons/1/14/Blackandtanbeer.jpg", "source": "https://commons.wikimedia.org/wiki/File:Blackandtanbeer.jpg", "license": "CC BY-SA 3.0", "artist": "User  Freonr2  on  en.wikipedia", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "credit": "User  Freonr2  on  en.wikipedia · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Black_and_tan", "difficulty": 4, "reviewed": true}, {"subject": "Tequila sunrise", "answer": "טקילה סאנרייז", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Tequila_Sunrise_%285084102035%29.jpg/500px-Tequila_Sunrise_%285084102035%29.jpg", "source": "https://commons.wikimedia.org/wiki/File:Tequila_Sunrise_(5084102035).jpg", "license": "CC BY 2.0", "artist": "TheCulinaryGeek  from Chicago, USA", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "credit": "TheCulinaryGeek  from Chicago, USA · CC BY 2.0", "subjectSource": "https://en.wikipedia.org/wiki/Tequila_sunrise", "difficulty": 4, "reviewed": true}, {"subject": "Blue Lagoon (cocktail)", "answer": "בלו לגון", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/Blue_Lagoon_at_the_Mandarin_Oriental%2C_Washington_DC.jpg/500px-Blue_Lagoon_at_the_Mandarin_Oriental%2C_Washington_DC.jpg", "source": "https://commons.wikimedia.org/wiki/File:Blue_Lagoon_at_the_Mandarin_Oriental,_Washington_DC.jpg", "license": "CC BY-SA 3.0", "artist": "John Phelan", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "credit": "John Phelan · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/Blue_Lagoon_%28cocktail%29", "difficulty": 4, "reviewed": true}, {"subject": "B-52 (cocktail)", "answer": "B52", "aliases": ["בי חמישים ושתיים", "בי 52", "B-52"], "image": "https://upload.wikimedia.org/wikipedia/commons/3/3a/Cocktail_B52.jpg", "source": "https://commons.wikimedia.org/wiki/File:Cocktail_B52.jpg", "license": "CC BY-SA 3.0", "artist": "Morpheus1703  / de.wikipedia.org", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "credit": "Morpheus1703  / de.wikipedia.org · CC BY-SA 3.0", "subjectSource": "https://en.wikipedia.org/wiki/B-52_%28cocktail%29", "difficulty": 4, "reviewed": true}], "photo-money": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/New_York_Stock_Exchange_-_panoramio_%282%29.jpg/960px-New_York_Stock_Exchange_-_panoramio_%282%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "בורסה", "aliases": [], "difficulty": 4, "credit": "TomasEE · CC BY 3.0 · https://web.archive.org/web/20161021111310/http://www.panoramio.com/photo/69848924", "source": "https://commons.wikimedia.org/wiki/File:New_York_Stock_Exchange_-_panoramio_(2).jpg", "license": "CC BY 3.0", "licenseUrl": "https://creativecommons.org/licenses/by/3.0", "artist": "TomasEE", "subjectSource": "https://en.wikipedia.org/wiki/Stock_exchange", "subjectTitle": "Stock exchange", "imageDescription": "New York Stock Exchange", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/WinonaSavingsBankVault.JPG/960px-WinonaSavingsBankVault.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חדר כספות", "aliases": [], "difficulty": 4, "credit": "Jonathunder · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:WinonaSavingsBankVault.JPG", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0", "artist": "Jonathunder", "subjectSource": "https://en.wikipedia.org/wiki/Bank_vault", "subjectTitle": "Bank vault", "imageDescription": "The door to the walk-in vault in the Winona Savings Bank in Winona, Minnesota, United States", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/8/81/Self_checkout_using_NCR_Fastlane_machines.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "קופה עצמית", "aliases": [], "difficulty": 4, "credit": "pin add · CC BY 2.0 · Self Checkout Uploaded by SchuminWeb", "source": "https://commons.wikimedia.org/wiki/File:Self_checkout_using_NCR_Fastlane_machines.jpg", "license": "CC BY 2.0", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "artist": "pin add", "subjectSource": "https://en.wikipedia.org/wiki/Self-checkout", "subjectTitle": "Self-checkout", "imageDescription": "Self Checkout", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Bitcoin_ATM_in_South_Africa.jpg/960px-Bitcoin_ATM_in_South_Africa.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "כספומט ביטקוין", "aliases": [], "difficulty": 4, "credit": "TapticInfo · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Bitcoin_ATM_in_South_Africa.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "TapticInfo", "subjectSource": "https://en.wikipedia.org/wiki/Cryptocurrency_ATM", "subjectTitle": "Cryptocurrency ATM", "imageDescription": "A Cryptocurrency ATM found in Sandton City, Johannesburg, South Africa", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Tem_phi%E1%BA%BFu_th%E1%BB%9Di_bao_c%E1%BA%A5p.jpg/960px-Tem_phi%E1%BA%BFu_th%E1%BB%9Di_bao_c%E1%BA%A5p.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "קופון", "aliases": [], "difficulty": 4, "credit": "Myra Siason · CC BY-SA 2.0 · Hanoi_Museum - 25.jpg", "source": "https://commons.wikimedia.org/wiki/File:Tem_phi%E1%BA%BFu_th%E1%BB%9Di_bao_c%E1%BA%A5p.jpg", "license": "CC BY-SA 2.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "artist": "Myra Siason", "subjectSource": "https://en.wikipedia.org/wiki/Coupon", "subjectTitle": "Coupon", "imageDescription": "Coupons used for buyings food stuff during the pre-Doi Moi period in Vietnam", "reviewed": true}], "photo-space": [{"subject": "Europa (moon)", "answer": "אירופה", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Europa_-_Perijove_45_%28cropped%29.png/500px-Europa_-_Perijove_45_%28cropped%29.png", "source": "https://commons.wikimedia.org/wiki/File:Europa_-_Perijove_45_(cropped).png", "license": "CC BY 2.0", "artist": "NASA/JPL-Caltech/SwRI/MSSS/Kevin M. Gill", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "credit": "NASA/JPL-Caltech/SwRI/MSSS/Kevin M. Gill · CC BY 2.0", "subjectSource": "https://en.wikipedia.org/wiki/Europa_%28moon%29", "difficulty": 4, "reviewed": true}, {"subject": "Ganymede (moon)", "answer": "גנימד", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Ganymede_-_Perijove_34_Composite.png/500px-Ganymede_-_Perijove_34_Composite.png", "source": "https://commons.wikimedia.org/wiki/File:Ganymede_-_Perijove_34_Composite.png", "license": "CC BY 2.0", "artist": "NASA/JPL-Caltech/SwRI/MSSS/ Kevin M. Gill", "licenseUrl": "https://creativecommons.org/licenses/by/2.0", "credit": "NASA/JPL-Caltech/SwRI/MSSS/ Kevin M. Gill · CC BY 2.0", "subjectSource": "https://en.wikipedia.org/wiki/Ganymede_%28moon%29", "difficulty": 4, "reviewed": true}, {"subject": "Enceladus", "answer": "אנקלדוס", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/PIA17202_-_Approaching_Enceladus.jpg/500px-PIA17202_-_Approaching_Enceladus.jpg", "source": "https://commons.wikimedia.org/wiki/File:PIA17202_-_Approaching_Enceladus.jpg", "license": "Public domain", "artist": "National Aeronautics and Space Administration  (NASA) /  Jet Propulsion Laboratory  (JPL)", "licenseUrl": "", "credit": "National Aeronautics and Space Administration  (NASA) /  Jet Propulsion Laboratory  (JPL) · Public domain", "subjectSource": "https://en.wikipedia.org/wiki/Enceladus", "difficulty": 4, "reviewed": true}, {"subject": "Triton (moon)", "answer": "טריטון", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Triton-usgs23-with-frame.jpg/500px-Triton-usgs23-with-frame.jpg", "source": "https://commons.wikimedia.org/wiki/File:Triton-usgs23-with-frame.jpg", "license": "CC BY 4.0", "artist": "Michael T. Bland, U.S. Geological Survey (USGS)", "licenseUrl": "https://creativecommons.org/licenses/by/4.0", "credit": "Michael T. Bland, U.S. Geological Survey (USGS) · CC BY 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Triton_%28moon%29", "difficulty": 4, "reviewed": true}, {"subject": "Horsehead Nebula", "answer": "ערפילית ראש הסוס", "aliases": [], "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Nebulosa_testa_di_cavallo_con_SPECULOOS.jpg/500px-Nebulosa_testa_di_cavallo_con_SPECULOOS.jpg", "source": "https://commons.wikimedia.org/wiki/File:Nebulosa_testa_di_cavallo_con_SPECULOOS.jpg", "license": "CC BY 4.0", "artist": "ESO", "licenseUrl": "https://creativecommons.org/licenses/by/4.0", "credit": "ESO · CC BY 4.0", "subjectSource": "https://en.wikipedia.org/wiki/Horsehead_Nebula", "difficulty": 2, "reviewed": true}], "photo-tools": [{"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d0/Bakelite_letter_opener.jpg/960px-Bakelite_letter_opener.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "פותחן מכתבים", "aliases": [], "difficulty": 4, "credit": "Sarefo · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Bakelite_letter_opener.jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Sarefo", "subjectSource": "https://en.wikipedia.org/wiki/Paper_knife", "subjectTitle": "Paper knife", "imageDescription": "Bakelite letter opener from Germany, probably around 1920.", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/2023_Rozszywacz_%282%29.jpg/960px-2023_Rozszywacz_%282%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "חולץ סיכות", "aliases": [], "difficulty": 4, "credit": "Jacek Halicki · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:2023_Rozszywacz_(2).jpg", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0", "artist": "Jacek Halicki", "subjectSource": "https://en.wikipedia.org/wiki/Staple_remover", "subjectTitle": "Staple remover", "imageDescription": "Staple remover", "reviewed": true}, {"image": "https://upload.wikimedia.org/wikipedia/commons/a/a7/Paper_cutter_1.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled", "answer": "גיליוטינת נייר", "aliases": [], "difficulty": 4, "credit": "Nathan nfm  at  English Wikipedia · CC BY-SA 3.0 · Transferred from en.wikipedia to Commons by Mendaliv using CommonsHelper .", "source": "https://commons.wikimedia.org/wiki/File:Paper_cutter_1.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "Nathan nfm  at  English Wikipedia", "subjectSource": "https://en.wikipedia.org/wiki/Paper_cutter", "subjectTitle": "Paper cutter", "imageDescription": "made this myself", "reviewed": true}, {"image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Seam_ripper.jpg/960px-Seam_ripper.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", "answer": "פורם תפרים", "aliases": [], "difficulty": 4, "credit": "No machine-readable author provided.  Dmeranda  assumed (based on copyright claims). · CC BY-SA 3.0 · No machine-readable source provided. Own work assumed (based on copyright claims).", "source": "https://commons.wikimedia.org/wiki/File:Seam_ripper.jpg", "license": "CC BY-SA 3.0", "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/", "artist": "No machine-readable author provided.  Dmeranda  assumed (based on copyright claims).", "subjectSource": "https://en.wikipedia.org/wiki/Seam_ripper", "subjectTitle": "Seam ripper", "imageDescription": "A closeup of the head of a  seam ripper , a sewing tool for cutting or removing stitches.  The blade edge, the longer of the two forked ends, is about 1cm long.  The length of the exposed metal end (shaft plus head) is about 3cm, at which it joins with the plastic handle.  The red spherical plastic ball at the end of the smaller of the forks is approximately 1.5mm in diameter.\n \nTaken with a Sony A100 camera using a Sony 2.8/100 Macro lens. Image has not been edited.", "reviewed": true}]};
// Issuer-bound, licensed images independently reviewed before inclusion.
for (const [id, items] of Object.entries(require('./issuer-additions.json'))) {
  PHOTO_ADDITIONS[id] = [...(PHOTO_ADDITIONS[id] || []), ...items];
}
for(const category of photos.CATEGORIES) {
  for(const item of PHOTO_ADDITIONS[category.id] || []) {
    const gestureVariant = category.id === 'photo-hands' && item.variantOf === item.answer && item.provider === 'pexels';
    if (!category.items.some(i=>i.image===item.image || !gestureVariant && i.answer===item.answer)) category.items.push(item);
  }
}
const { judge, couldMatchProfile, transcriptProfile, prepareItem, findAllRivals } = require('../../server/judge');

const ROOT = path.join(__dirname, '..', '..', 'content');
const MEDIA = path.join(ROOT, 'media');
const PACKS = path.join(ROOT, 'packs');

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

const slugify = (value, fallback) =>
  String(value).replace(/[^\w֐-׿-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || fallback;

/** מנרמל קטגוריה אחת ממקור כלשהו לפורמט החבילות. */
function normalize(category, kind) {
  const items = category.items.map((item, index) => {
    // מקורות אמוג'י וטקסט מחזירים מערך: [רמז, תשובה, ...נרדפות]
    // פריט תמונה מוכן (קטגוריות תמונות אמיתיות): ה-URL כבר אפוי בנתונים
    if (item.image) {
      return {
        image: item.image,
        answer: item.answer,
        aliases: item.aliases || [],
        ...(item.credit ? { credit: item.credit } : {}),
        ...Object.fromEntries(['source', 'license', 'licenseUrl', 'artist', 'subjectSource', 'provider', 'objectID', 'isPublicDomain', 'metadataSource', 'mediaID', 'observationID', 'photoID', 'photoLicenseCode', 'taxonName'].filter((key) => item[key]).map((key) => [key, item[key]])),
        difficulty: item.difficulty,
      };
    }
    if (Array.isArray(item)) {
      const [clue, answer, ...aliases] = item;
      if (kind === 'emoji') {
        // שם הקובץ נגזר מנקודות הקוד של האמוג'י ולא ממקומו ברשימה: כך הוספת
        // פריט באמצע אינה משנה את שמות כל השאר, ואמוג'י שנכתב פעמיים נופל
        // על אותו שם ומסולק בניכוי הכפילויות. בלי זה כפילות הייתה עוברת.
        const slug = [...clue].map((ch) => ch.codePointAt(0).toString(16)).join('-');
        write(path.join(MEDIA, category.id, `${slug}.svg`), emojiSvg(clue));
        return { image: `/media/${category.id}/${slug}.svg`, answer, aliases };
      }
      return { text: clue, answer, aliases };
    }
    // מקורות משורטטים מחזירים אובייקט עם svg מוכן או רמז מילולי
    if (item.svg) {
      const slug = slugify(item.slug, `${category.id}-${index}`);
      write(path.join(MEDIA, category.id, `${slug}.svg`), item.svg);
      return {
        image: `/media/${category.id}/${slug}.svg`,
        answer: item.answer,
        aliases: item.aliases || [],
        ...(item.typedAliases ? { typedAliases: item.typedAliases } : {}),
        difficulty: item.difficulty,
      };
    }
    return {
      text: item.text,
      answer: item.answer,
      aliases: item.aliases || [],
      difficulty: item.difficulty,
    };
  });

  return { id: category.id, name: category.name, hint: category.hint || null, items };
}

const BANDS = 5;

/**
 * מקצה דרגת קושי 1..5 לכל פריט.
 *
 * מקור שיודע לדרג בעצמו (מחולל פרמטרי, למשל) מספק difficulty מפורש. אחרת
 * הדרגה נגזרת ממקום הפריט ברשימה: הרשימות נכתבו מהמוכר אל הנדיר, ולכן
 * המיקום הוא קירוב סביר לקושי.
 */
function assignDifficulty(category) {
  const total = category.items.length;
  category.items.forEach((item, index) => {
    if (item.difficulty) return;
    item.difficulty = Math.min(BANDS, Math.floor((index / total) * BANDS) + 1);
  });
  return category;
}

/**
 * תשובות דומות מדי באותה קטגוריה שוברות את המשחק: מנוע ההכרעה יקבל את
 * "קונגו" גם כשהתמונה היא "רפובליקת קונגו", והשחקן יזכה בנקודה על טעות.
 * לכן כל קטגוריה נבדקת מול עצמה לפני שהיא נכתבת.
 */
function findCollisions(category) {
  const collisions = [];
  // אותה הכנה שהשרת עושה בזמן ריצה, כולל יריבים — אחרת נדווח על התנגשויות
  // שמנוע ההכרעה כבר יודע להבחין ביניהן
  const rivals = findAllRivals(category.items.map((i) => i.answer));
  const prepared = category.items.map((i) => prepareItem({ ...i, rivals: rivals.get(i.answer) }));
  // הפרופיל תלוי בתשובה בלבד, והיא נבדקת מול כל שאר הפריטים — מחשבים פעם אחת
  const profiles = category.items.map((i) => transcriptProfile(i.answer));
  for (let i = 0; i < category.items.length; i++) {
    for (let j = i + 1; j < category.items.length; j++) {
      const a = category.items[i];
      const b = category.items[j];
      if (a.answer === b.answer) continue; // אותו פריט בדיוק — רק כפילות
      // מסנן זול לפני הכרעה מלאה: בקטגוריה של אלף תרגילים זו ההפרש בין דקה
      // לשנייה, והוא חוסם רק זוגות שההכרעה ממילא לא יכולה לקבל
      const canIJ = couldMatchProfile(profiles[i], prepared[j]);
      const canJI = couldMatchProfile(profiles[j], prepared[i]);
      if (!canIJ && !canJI) continue;
      if ((canIJ && judge(a.answer, prepared[j]).verdict === 'correct')
        || (canJI && judge(b.answer, prepared[i]).verdict === 'correct')) {
        // אותו זוג תשובות יכול לחזור בפריטים שונים — מדווחים עליו פעם אחת
        const key = [a.answer, b.answer].sort().join(' / ');
        if (!collisions.includes(key)) collisions.push(key);
      }
    }
  }
  return collisions;
}

/**
 * מסיר פריטים שהרמז שלהם חוזר, כדי שחפיסה לא תציג אותה שאלה פעמיים.
 * המפתח הוא הרמז ולא התשובה: "3 + 4" ו-"12 − 5" הן שתי שאלות שונות
 * לגמרי, גם אם שתיהן נענות ב"שבע".
 */
function dedupe(category) {
  const seen = new Set();
  category.items = category.items.filter((item) => {
    const key = item.image || item.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return category;
}

function build({ force = false, minItems = 10, quiet = false } = {}) {
  if (!force && fs.existsSync(PACKS) && fs.readdirSync(PACKS).some((f) => f.endsWith('.json'))) {
    return null;
  }
  fs.rmSync(MEDIA, { recursive: true, force: true });
  fs.rmSync(PACKS, { recursive: true, force: true });

  const sources = [
    ...emoji.CATEGORIES.map((c) => [c, 'emoji']),
    ...text.CATEGORIES.map((c) => [c, 'text']),
    ...countries.build({ minItems }).map((c) => [c, 'drawn']),
    ...drawn.build().map((c) => [c, 'drawn']),
    ...flags.build().map((c) => [c, 'drawn']),
    ...generated.build().map((c) => [c, 'drawn']),
    ...numeric.build().map((c) => [c, 'drawn']),
    ...photos.CATEGORIES.map((c) => [c, 'photo']),
  ];

  const report = { categories: 0, items: 0, skipped: [], collisions: [], smallest: Infinity };
  const ids = new Set();

  for (const [source, kind] of sources) {
    if (ids.has(source.id)) throw new Error(`מזהה קטגוריה כפול: ${source.id}`);
    ids.add(source.id);

    const category = assignDifficulty(dedupe(expandVariants(enrichPhotos(normalize(source, kind), photos.CATEGORIES, findCollisions), { media: MEDIA, write })));
    if (category.items.length < minItems) {
      report.skipped.push(`${category.id} (${category.items.length} פריטים)`);
      continue;
    }

    const collisions = findCollisions(category);
    if (collisions.length) {
      report.collisions.push(`${category.id}: ${collisions.join(', ')}`);
    }

    write(path.join(PACKS, `${category.id}.json`), JSON.stringify(category, null, 2));
    report.categories++;
    report.items += category.items.length;
    report.smallest = Math.min(report.smallest, category.items.length);
  }

  if (!quiet) {
    console.log(`נוצרו ${report.categories} קטגוריות, ${report.items} פריטים.`);
    if (report.skipped.length) console.log(`דולגו (מעט מדי פריטים): ${report.skipped.join(', ')}`);
    for (const c of report.collisions) console.warn(`⚠ תשובות מתנגשות — ${c}`);
  }
  return report;
}

module.exports = { build, findCollisions, PACKS, MEDIA };
