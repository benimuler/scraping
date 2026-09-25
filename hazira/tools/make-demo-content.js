'use strict';

/**
 * נקודת הכניסה לבניית התוכן. המקורות עצמם יושבים תחת tools/content/.
 * רץ אוטומטית ב-install וב-start; `npm run content` בונה מחדש בכוח.
 */

const { build } = require('./content/build');

if (require.main === module) build({ force: process.argv.includes('--force') });
module.exports = { build };
