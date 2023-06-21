const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs/promises');
const fps = require('fs/promises');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');
const docx = require('docx');
const { Document, Paragraph } = docx;
const { Packer } = docx;

function writeTextToWordFile(text, filename) {
    const doc = new Document();
    const paragraph = new Paragraph(text);
    doc.addParagraph(paragraph);
  
    Packer.toBuffer(doc).then((buffer) => {
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
      }
      fs.writeFileSync(filename, buffer);
      console.log(`Successfully wrote "${text}" to ${filename}`);
    }).catch((error) => {
      console.error(`Error writing "${text}" to ${filename}: ${error}`);
    });
  }
  
writeTextToWordFile('This is some sample text.', 'sample.docx');

const websiteUrl = 'https://www.bhol.co.il/Forums/search_user.asp?userid=18552';

const getAllLinks = async () => {
  const { data } = await axios({ url: websiteUrl, method: 'GET', responseType: 'arraybuffer' });
  const encoding = jschardet.detect(data).encoding;
  const decodedText = iconv.decode(data, encoding);
  const $ = cheerio.load(decodedText);
  const links = [];

  $('a').each((index, element) => {
    const href = $(element).attr('href');
    if (href.includes('topic_id')) links.push(href);
  });
  return links;
};

const passOnLinks = async () => {
//   await fs.mkdir('./tmp');
  const links = await getAllLinks();
  await Promise.all(links.map((link, index) => saveToFileByLink(`https://www.bhol.co.il/Forums/${link}`, index + 1)));
};

const saveToFileByLink = async (link, index) => {
  const { data } = await axios({ url: link, method: 'GET', responseType: 'arraybuffer' });
  const encoding = jschardet.detect(data).encoding;
  const decodedText = iconv.decode(data, encoding);
  const $ = cheerio.load(decodedText);
  const hebrewText = $('p').text();
  const filename = `tmp/${index}.docx`;
  if (hebrewText.includes('ווטו1')) {
    writeTextToWordFile(hebrewText, filename);
    // await fps.writeFile(filename, hebrewText, { encoding: 'utf8' });
  }
};

// passOnLinks();
