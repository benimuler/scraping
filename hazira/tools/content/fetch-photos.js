'use strict';
/**
 * Reviewed photo pools live in photos-data/<category>.json.
 * Do not automatically substitute Wikipedia search hits: a licensed photo can
 * still be the wrong subject (the old pipeline selected a portrait for lotus).
 *
 * node tools/content/fetch-photos.js            Offline safety validation.
 * node tools/content/fetch-photos.js --refresh  Recheck current Commons license
 * metadata, preserving reviewed image choices. Writes only if ALL checks pass.
 * New subjects require exact-page provenance and manual pixel review first.
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'photos-data');
const strip = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const free = (s) => /^(CC BY(?:-SA)? [1234]|CC0|Public domain)/.test(s) && !/NC|ND/.test(s);
// Exact official object/media pairs, individually checked for selected-media CC0 rights.
const NMNH_MEDIA = {"nmnhmineralsciences_17124213":{"source":"https://www.si.edu/object/nmnhmineralsciences_17124213","mediaID":"ark:/65665/m3e4558f4224274d4794f5a6d9c78dbf24","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m3e4558f4224274d4794f5a6d9c78dbf24&max_w=800"},"nmnhmineralsciences_1008594":{"source":"https://www.si.edu/object/opal%3Anmnhmineralsciences_1008594","mediaID":"ark:/65665/m33af5655485d44cf59dbb4c8c563808a8","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m33af5655485d44cf59dbb4c8c563808a8&max_w=800"},"nmnhmineralsciences_1105408":{"source":"https://www.si.edu/object/beryl-var-aquamarine:nmnhmineralsciences_1105408","mediaID":"ark:/65665/m30d94671f6ee8479487a6b4f0cfae8d5f","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m30d94671f6ee8479487a6b4f0cfae8d5f&max_w=800"},"nmnhmineralsciences_1079737":{"source":"https://www.si.edu/object/topaz%3Anmnhmineralsciences_1079737","mediaID":"ark:/65665/m3d063bd4d3ccd452298364572e7133a96","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m3d063bd4d3ccd452298364572e7133a96&max_w=800"},"nmnhmineralsciences_16580233":{"source":"https://www.si.edu/object/nmnhmineralsciences_16580233","mediaID":"ark:/65665/m30153e2b1fb614146a2c086f1a23b0cc4","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m30153e2b1fb614146a2c086f1a23b0cc4&max_w=800"},"nmnhmineralsciences_1174303":{"source":"https://www.si.edu/object/elbaite:nmnhmineralsciences_1174303","mediaID":"ark:/65665/m3c7cd06dba803492190018e93806ca44f","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m3c7cd06dba803492190018e93806ca44f&max_w=800"},"nmnhmineralsciences_1082279":{"source":"https://www.si.edu/object/beryl-var-emerald:nmnhmineralsciences_1082279","mediaID":"ark:/65665/m3b949c5d43a8e414fa69eceaae90e3f05","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m3b949c5d43a8e414fa69eceaae90e3f05&max_w=800"},"nmnhmineralsciences_11722358":{"source":"https://www.si.edu/object/spinel:nmnhmineralsciences_11722358","mediaID":"ark:/65665/m3f85fcfdff6a345b39275ffeabd829789","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m3f85fcfdff6a345b39275ffeabd829789&max_w=800"},"nmnhmineralsciences_10209820":{"source":"https://naturalhistory.si.edu/object/nmnhmineralsciences_10209820","mediaID":"ark:/65665/m31861ef226ed344e4b5a154a76f064b6c","image":"https://ids.si.edu/ids/deliveryService?max=800&id=ark:/65665/m31861ef226ed344e4b5a154a76f064b6c"},"nmnhmineralsciences_1000714":{"source":"https://www.naturalhistory.si.edu/object/nmnhmineralsciences_1000714","mediaID":"ark:/65665/m3eb01b22b80d542d7933e61a42ae5a7b9","image":"https://ids.si.edu/ids/deliveryService?max=800&id=ark:/65665/m3eb01b22b80d542d7933e61a42ae5a7b9"}};
// Exact USGS photo pages with per-image Public Domain statements and pixel review.
const USGS_MEDIA = {"mississippi-delta":{"source":"https://www.usgs.gov/media/images/mississippi-delta","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/miss_delta2.jpg?itok=hE-pbRww"},"aerial-view-sperry-glacier-glacier-national-park-montana":{"source":"https://www.usgs.gov/media/images/aerial-view-sperry-glacier-glacier-national-park-montana","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/media/images/SperryGL_GlacierNP090109-_577%20copy%202.jpg?itok=MA0xP15f"},"sinkhole-frederick-maryland":{"source":"https://www.usgs.gov/media/images/sinkhole-frederick-maryland","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/Maryland__FredSinkhole_9-03.JPG?itok=AAZhbbgT"},"stalactites-carlsbad-caverns-natural-entrance":{"source":"https://www.usgs.gov/media/images/stalactites-carlsbad-caverns-natural-entrance","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/DSC01031.JPG?itok=iGsZMD80"},"landslide":{"source":"https://www.usgs.gov/media/images/landslide","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/landslide.jpg?itok=ZzvyVV2d"},"kilauea-volcano-lava-flowing-fissure-8":{"source":"https://www.usgs.gov/media/images/kilauea-volcano-lava-flowing-fissure-8","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/multimediaFile-2367_0.jpg?itok=hTjrCO8m"},"grand-prismatic-spring-midway-geyser-basin-yellowstone-national-park":{"source":"https://www.usgs.gov/media/images/grand-prismatic-spring-midway-geyser-basin-yellowstone-national-park","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/media/images/Midway.png?itok=jlXNPchs"},"mud-cracks-little-grand-wash-utah-alan-cressler":{"source":"https://www.usgs.gov/media/images/mud-cracks-little-grand-wash-utah-alan-cressler","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/MudCracks_LittleGrandWash_UT_AlanCressler.jpg?itok=P-oW0scm"},"salt-flat-death-valley":{"source":"https://www.usgs.gov/media/images/salt-flat-death-valley","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/usgsatwork-mar2020_0.JPG?itok=qTFrvydq"},"petrified-wood":{"source":"https://www.usgs.gov/media/images/petrified-wood","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/DSC01198.JPG?itok=FiqN7-Tl"},"emergent-vegetation-a-wetland":{"source":"https://www.usgs.gov/media/images/emergent-vegetation-a-wetland","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/media/images/2021_06_21_BozimowskiAlexandra_USGS.jpg?itok=wiWxe8dR"},"lost-palms-oasis":{"source":"https://www.usgs.gov/media/images/lost-palms-oasis","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/i5297.jpg?itok=0tRyLhzo"},"tide-pool-habitat-rocky-lava-coast":{"source":"https://www.usgs.gov/media/images/tide-pool-habitat-rocky-lava-coast","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/Biomes_WaterWetlands_PoolsPuddles_00002.jpg?itok=6qrM6O8s"},"aerial-view-meteor-crater-color-coconino-county-arizona":{"source":"https://www.usgs.gov/media/images/aerial-view-meteor-crater-color-coconino-county-arizona","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/rdj00001_cp.jpg?itok=85j8fJ0Z"},"stalagmites-caverns-sonora":{"source":"https://www.usgs.gov/media/images/stalagmites-caverns-sonora","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/DSC00919.JPG?itok=ZD3g6tfR"},"desert-landscape":{"source":"https://www.usgs.gov/media/images/desert-landscape","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/winter__MesquiteLakesNV_stk.jpg?itok=aFYOIapi"},"basalt-columns-along-us-highway-26":{"source":"https://www.usgs.gov/media/images/basalt-columns-along-us-highway-26","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/jd300%20%281%29.jpg?itok=dKt1ydXY"},"fossil-ammonite":{"source":"https://www.usgs.gov/media/images/fossil-ammonite","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/ammonite_A.Scott_090319.jpg?itok=3a5BQWn2"},"lodgepole-pine-cone-sierra":{"source":"https://www.usgs.gov/media/images/lodgepole-pine-cone-sierra","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/Day11_LodgepoleCone_RKlinger.JPG?itok=ko_u4krg"},"pitcher-plant-sarracenia-purpurea":{"source":"https://www.usgs.gov/media/images/pitcher-plant-sarracenia-purpurea","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/res_pic_pris1_big.jpg?itok=6H_8UzyV"},"edmunds-pettus-bridge":{"source":"https://www.usgs.gov/media/images/edmunds-pettus-bridge","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/Edmund-Pettus-Bridge-nps%20walking%20classroom.jpg?itok=GGoKV7Er"},"coal-burning-power-plant":{"source":"https://www.usgs.gov/media/images/coal-burning-power-plant","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/coalplant.jpg?itok=_INw2nnw"},"solar-panels":{"source":"https://www.usgs.gov/media/images/solar-panels","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/Energy_Trip_145.jpg?itok=COo3HYJy"},"a-pumpjack-active-oil-or-gas-drilling-site-new-mexico":{"source":"https://www.usgs.gov/media/images/a-pumpjack-active-oil-or-gas-drilling-site-new-mexico","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/media/images/Pumpjack_ActiveSite_Farmington_NM_5.22.2019_Duniway_SBSC_USGS.jpg?itok=gR9IJZUt"},"all-american-canal":{"source":"https://www.usgs.gov/media/images/all-american-canal","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/all%20American%20Canal.png?itok=J9XlZh25"},"automated-radio-telemetry-tower":{"source":"https://www.usgs.gov/media/images/automated-radio-telemetry-tower","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/media/images/Zenzal_border%20wall_fig%202.png.jpg?itok=nO4CocLh"},"mount-baker-background-tesoro-oil-refinery-padilla":{"source":"https://www.usgs.gov/media/images/mount-baker-background-tesoro-oil-refinery-padilla","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/vhp_img3057.jpg?itok=mdrM_f2R"},"wind-turbines":{"source":"https://www.usgs.gov/media/images/wind-turbines","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/02_Bats_and_Wind_Energy.JPG?itok=V43D2cqz"},"oil-platform":{"source":"https://www.usgs.gov/media/images/oil-platform","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/media/images/20180714_143609_1.jpg?itok=eR_Gn8FF"},"transmission-lines":{"source":"https://www.usgs.gov/media/images/transmission-lines","image":"https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/styles/full_width/public/thumbnails/image/transmission-lines-1.jpg?itok=ScHSvzZA"}};
// Exact DVIDS photo/source pairs individually reviewed for PD and factual subject.
const DVIDS_MEDIA = {"6465107":{"source":"https://www.dvidshub.net/image/6465107","image":"https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/2012/6465107/1000w_q95.jpg"},"2187827":{"source":"https://www.dvidshub.net/image/2187827/top-marines-mess-hall-serves-12th-marines","image":"https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1509/2187827/1000w_q95.jpg"}};
// Exact item-only Pexels photographs checked against current license, page and pixels.
const PEXELS_MEDIA = {"5419216":{"source":"https://www.pexels.com/photo/plate-with-delicious-cinnabon-5419216/","image":"https://images.pexels.com/photos/5419216/pexels-photo-5419216.jpeg?auto=compress&cs=tinysrgb&w=1000"},"3776940":{"source":"https://www.pexels.com/photo/photo-of-macarons-on-plate-3776940/","image":"https://images.pexels.com/photos/3776940/pexels-photo-3776940.jpeg?auto=compress&cs=tinysrgb&w=1000"},"21424384":{"source":"https://www.pexels.com/photo/close-up-of-a-slice-of-cheesecake-on-a-white-plate-21424384/","image":"https://images.pexels.com/photos/21424384/pexels-photo-21424384/free-photo-of-close-up-of-a-slice-of-cheesecake-on-a-white-plate.jpeg?auto=compress&cs=tinysrgb&w=1000"},"8081573":{"source":"https://www.pexels.com/photo/a-plate-of-chocolate-chip-cookies-8081573/","image":"https://images.pexels.com/photos/8081573/pexels-photo-8081573.jpeg?auto=compress&cs=tinysrgb&w=1000"},"12391407":{"source":"https://www.pexels.com/photo/top-view-of-waffles-and-strawberries-on-white-plate-12391407/","image":"https://images.pexels.com/photos/12391407/pexels-photo-12391407.jpeg?auto=compress&cs=tinysrgb&w=1000"},"17095342":{"source":"https://www.pexels.com/photo/croissant-on-plate-17095342/","image":"https://images.pexels.com/photos/17095342/pexels-photo-17095342/free-photo-of-croissant-on-plate.jpeg?auto=compress&cs=tinysrgb&w=1000"},"14954572":{"source":"https://www.pexels.com/photo/close-up-christmas-gingerbread-cookies-14954572/","image":"https://images.pexels.com/photos/14954572/pexels-photo-14954572.jpeg?auto=compress&cs=tinysrgb&w=1000"},"31251476":{"source":"https://www.pexels.com/photo/ceramic-cup-of-matcha-tea-on-wooden-tray-31251476/","image":"https://images.pexels.com/photos/31251476/pexels-photo-31251476/free-photo-of-ceramic-cup-of-matcha-tea-on-wooden-tray.png?auto=compress&cs=tinysrgb&w=1000"},"6932376":{"source":"https://www.pexels.com/photo/coffee-being-brewed-in-a-glass-6932376/","image":"https://images.pexels.com/photos/6932376/pexels-photo-6932376.jpeg?auto=compress&cs=tinysrgb&w=1000"},"33241812":{"source":"https://www.pexels.com/photo/refreshing-iced-thai-milk-tea-on-wooden-table-33241812/","image":"https://images.pexels.com/photos/33241812/pexels-photo-33241812/free-photo-of-refreshing-iced-thai-milk-tea-on-wooden-table.jpeg?auto=compress&cs=tinysrgb&w=1000"},"17612825":{"source":"https://www.pexels.com/photo/a-glass-of-iced-tea-with-lemon-slices-17612825/","image":"https://images.pexels.com/photos/17612825/pexels-photo-17612825/free-photo-of-a-glass-of-iced-tea-with-lemon-slices.jpeg?auto=compress&cs=tinysrgb&w=1000"},"7713400":{"source":"https://www.pexels.com/photo/black-graduation-cap-on-white-table-7713400/","image":"https://images.pexels.com/photos/7713400/pexels-photo-7713400.jpeg?auto=compress&cs=tinysrgb&w=1000"},"19312030":{"source":"https://www.pexels.com/photo/handmade-advent-calendar-19312030/","image":"https://images.pexels.com/photos/19312030/pexels-photo-19312030/free-photo-of-handmade-advent-calendar.jpeg?auto=compress&cs=tinysrgb&w=1000"},"5868974":{"source":"https://www.pexels.com/photo/white-and-red-candy-canes-on-pink-background-5868974/","image":"https://images.pexels.com/photos/5868974/pexels-photo-5868974.jpeg?auto=compress&cs=tinysrgb&w=1000"},"20182114":{"source":"https://www.pexels.com/photo/basket-with-easter-eggs-20182114/","image":"https://images.pexels.com/photos/20182114/pexels-photo-20182114/free-photo-of-basket-with-easter-eggs.jpeg?auto=compress&cs=tinysrgb&w=1000"},"30604307":{"source":"https://www.pexels.com/photo/traditional-diwali-oil-lamps-lit-in-ceremony-30604307/","image":"https://images.pexels.com/photos/30604307/pexels-photo-30604307/free-photo-of-traditional-diwali-oil-lamps-lit-in-ceremony.jpeg?auto=compress&cs=tinysrgb&w=1000"},"34400039":{"source":"https://www.pexels.com/photo/vibrant-diwali-rangoli-with-lit-diya-lamp-34400039/","image":"https://images.pexels.com/photos/34400039/pexels-photo-34400039/free-photo-of-vibrant-diwali-rangoli-with-lit-diya-lamp.jpeg?auto=compress&cs=tinysrgb&w=1000"}};
function reviewedAsset(item) {
  const source = new URL(item.source);
  const image = new URL(item.image);
  if (source.protocol !== 'https:' || image.protocol !== 'https:') throw Error('Asset must use HTTPS');
  const commons = source.hostname === 'commons.wikimedia.org' && source.pathname.startsWith('/wiki/File:') &&
    ['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(image.hostname) && /\.(jpe?g|png|webp)$/i.test(image.pathname);
  const id = source.pathname.match(/^\/art\/collection\/search\/(\d+)$/)?.[1];
  const met = ['www.metmuseum.org', 'metmuseum.org'].includes(source.hostname) && id &&
    image.hostname === 'images.metmuseum.org' && /^\/CRDImages\/[a-z]+\/(web-large|original)\/[^/]+\.jpg$/i.test(image.pathname) &&
    item.provider === 'met' && item.objectID === Number(id) && item.isPublicDomain === true &&
    item.license === 'CC0' && item.licenseUrl === 'https://www.metmuseum.org/openaccess' &&
    item.metadataSource === `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;
  const mediaID = source.hostname === 'airandspace.si.edu' && source.pathname.match(/^\/collection-media\/(NASM-[A-Za-z0-9-]+)$/)?.[1];
  const smithsonian = mediaID && item.provider === 'smithsonian-nasm' && item.mediaID === mediaID &&
    image.hostname === 'ids.si.edu' && image.pathname === '/ids/deliveryService' && image.searchParams.get('id') === mediaID &&
    [...image.searchParams.keys()].every(k=>['id','max_w'].includes(k)) && image.searchParams.get('max_w') === '900' &&
    item.license === 'CC0' && item.licenseUrl === 'https://creativecommons.org/publicdomain/zero/1.0/';
  const observationID = source.hostname === 'www.inaturalist.org' && source.pathname.match(/^\/observations\/(\d+)$/)?.[1];
  const photoID = image.hostname === 'inaturalist-open-data.s3.amazonaws.com' && image.pathname.match(/^\/photos\/(\d+)\/large\.(jpe?g)$/)?.[1];
  const inatLicense = {cc0:['CC0','https://creativecommons.org/publicdomain/zero/1.0/'], 'cc-by':['CC BY 4.0','https://creativecommons.org/licenses/by/4.0/'], 'cc-by-sa':['CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/']}[item.photoLicenseCode];
  const inaturalist = observationID && photoID && item.provider === 'inaturalist' && item.observationID === Number(observationID) &&
    item.photoID === Number(photoID) && item.metadataSource === `https://api.inaturalist.org/v1/observations/${observationID}` &&
    item.taxonName && inatLicense && item.license === inatLicense[0] && item.licenseUrl === inatLicense[1];
  const bound = NMNH_MEDIA[item.objectID];
  const nmnh = item.provider === 'smithsonian-nmnh' && bound &&
    item.source === bound.source && item.image === bound.image && item.mediaID === bound.mediaID &&
    item.isPublicDomain === true && item.metadataSource === item.source &&
    item.license === 'CC0' && item.licenseUrl === 'https://creativecommons.org/publicdomain/zero/1.0/';
  const usgsBound = USGS_MEDIA[item.objectID];
  const usgs = item.provider === 'usgs' && usgsBound &&
    item.source === usgsBound.source && item.image === usgsBound.image &&
    item.isPublicDomain === true && item.metadataSource === item.source &&
    item.license === 'Public domain' && item.licenseUrl === 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits';
  const dvidsBound = DVIDS_MEDIA[item.objectID];
  const dvids = item.provider === 'dvids' && dvidsBound &&
    item.source === dvidsBound.source && item.image === dvidsBound.image &&
    item.isPublicDomain === true && item.metadataSource === item.source &&
    item.license === 'Public domain' && item.licenseUrl === 'https://www.dvidshub.net/about/copyright' &&
    item.credit.includes('The appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement.');
  const pexelsBound = PEXELS_MEDIA[item.objectID];
  const pexels = item.provider === 'pexels' && pexelsBound &&
    item.source === pexelsBound.source && item.image === pexelsBound.image &&
    item.metadataSource === item.source && item.license === 'Pexels License' &&
    item.licenseUrl === 'https://www.pexels.com/license/';
  if (!pexels && !commons && !met && !smithsonian && !inaturalist && !nmnh && !usgs && !dvids) throw Error('Invalid reviewed asset provenance');
}
function validate(category) {
  const answers = new Set();
  const images = new Set();
  for (const item of category.items) {
    if (!item.answer || !item.reviewed) throw Error(`${category.id}: missing answer/pixel review`);
    if (!(free(item.license) || item.provider === 'pexels' && item.license === 'Pexels License') || !item.artist || !item.credit) throw Error(`${category.id}/${item.answer}: missing free license/credit`);
    reviewedAsset(item);
    if (answers.has(item.answer) || images.has(item.image)) throw Error(`${category.id}: duplicate answer/image`);
    answers.add(item.answer); images.add(item.image);
  }
}
async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
  const categories = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
  categories.forEach(validate);
  if (process.argv.includes('--refresh')) {
    if (categories.some(c => c.items.some(i => ['smithsonian-nasm','smithsonian-nmnh','inaturalist','usgs','dvids','pexels'].includes(i.provider))))
      throw Error('Issuer-specific manual rights refresh required; no files written');
    // Never apply Commons metadata to another issuer. Recheck exact Met object.
    for (const c of categories) for (const i of c.items.filter(i => i.provider === 'met')) {
      const response = await fetch(i.metadataSource);
      if (!response.ok) throw Error(`Met ${response.status}; no files written`);
      const object = await response.json();
      if (object.objectID !== i.objectID || object.isPublicDomain !== true ||
          ![object.primaryImage, object.primaryImageSmall].includes(i.image) ||
          object.objectURL !== i.source) throw Error('Met provenance changed; no files written');
    }
    for (const c of categories) {
      for (let n = 0; n < c.items.length; n += 20) {
        const batch = c.items.slice(n, n + 20).filter((i) => !i.provider);
        if (!batch.length) continue;
        const titles = batch.map((i) => decodeURIComponent(new URL(i.source).pathname.slice('/wiki/'.length)));
        const url = new URL('https://commons.wikimedia.org/w/api.php');
        url.search = new URLSearchParams({action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'extmetadata', titles: titles.join('|')});
        const response = await fetch(url, {headers: {'User-Agent': 'PicDuelContent/2.0 (hazirapicduel@mailfence.com)'}});
        if (!response.ok) throw Error(`Commons ${response.status}; no files written`);
        const data = await response.json();
        const pages = new Map((data.query?.pages || []).map((p) => [p.title.replaceAll(' ', '_'), p]));
        batch.forEach((i, k) => {
          const meta = pages.get(titles[k].replaceAll(' ', '_'))?.imageinfo?.[0]?.extmetadata;
          const license = strip(meta?.LicenseShortName?.value);
          const artist = strip(meta?.Artist?.value);
          if (!free(license) || !artist) throw Error(`${titles[k]} no longer passes; no files written`);
          i.license = license; i.artist = artist; i.credit = `${artist} · ${license}`;
          i.licenseUrl = meta.LicenseUrl?.value || '';
        });
      }
    }
    categories.forEach(validate);
    categories.forEach((c, n) => fs.writeFileSync(path.join(DIR, files[n]), JSON.stringify(c, null, 2) + '\n'));
  }
  console.log(`${categories.length} reviewed categories, ${categories.reduce((n, c) => n + c.items.length, 0)} items validated`);
}
if (require.main === module) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
module.exports = { validate, free, reviewedAsset };
