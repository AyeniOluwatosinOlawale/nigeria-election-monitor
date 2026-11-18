#!/usr/bin/env node
// gen-lga-seed.js — generates supabase/seed_lga_2023.sql
// Distributes state-level presidential_2023 votes equally across LGAs.

const fs = require('fs');
const path = require('path');

// ─── LGA map (all 774 official INEC LGA names) ───────────────────────────────

const LGA_MAP = {
  AB: ["Aba North","Aba South","Arochukwu","Bende","Ikwuano","Isiala Ngwa North","Isiala Ngwa South","Isuikwuato","Obi Ngwa","Ohafia","Osisioma Ngwa","Ugwunagbo","Ukwa East","Ukwa West","Umuahia North","Umuahia South","Umu Nneochi"],
  AD: ["Demsa","Fufore","Ganye","Girei","Gombi","Guyuk","Hong","Jada","Lamurde","Madagali","Maiha","Mayo-Belwa","Michika","Mubi North","Mubi South","Numan","Shelleng","Song","Toungo","Yola North","Yola South"],
  AK: ["Abak","Eastern Obolo","Eket","Esit Eket","Essien Udim","Etim Ekpo","Etinan","Ibeno","Ibesikpo Asutan","Ibiono-Ibom","Ika","Ikono","Ikot Abasi","Ikot Ekpene","Ini","Itu","Mbo","Mkpat Enin","Nsit Atai","Nsit Ibom","Nsit Ubium","Obot Akara","Okobo","Onna","Oron","Oruk Anam","Udung Uko","Ukanafun","Uruan","Urue-Offong/Oruko","Uyo"],
  AN: ["Aguata","Anambra East","Anambra West","Anaocha","Awka North","Awka South","Ayamelum","Dunukofia","Ekwusigo","Idemili North","Idemili South","Ihiala","Njikoka","Nnewi North","Nnewi South","Ogbaru","Onitsha North","Onitsha South","Orumba North","Orumba South","Oyi"],
  BA: ["Alkaleri","Bauchi","Bogoro","Damban","Darazo","Dass","Gamawa","Ganjuwa","Giade","Itas/Gadau","Jama'are","Katagum","Kirfi","Misau","Ningi","Shira","Tafawa Balewa","Toro","Warji","Zaki"],
  BY: ["Brass","Ekeremor","Kolokuma/Opokuma","Nembe","Ogbia","Sagbama","Southern Ijaw","Yenagoa"],
  BE: ["Ado","Agatu","Apa","Buruku","Gboko","Guma","Gwer East","Gwer West","Katsina-Ala","Konshisha","Kwande","Logo","Makurdi","Obi","Ogbadibo","Ohimini","Oju","Okpokwu","Otukpo","Tarka","Ukum","Ushongo","Vandeikya"],
  BO: ["Abadam","Askira/Uba","Bama","Bayo","Biu","Chibok","Damboa","Dikwa","Gubio","Guzamala","Gwoza","Hawul","Jere","Kaga","Kala/Balge","Konduga","Kukawa","Kwaya Kusar","Mafa","Magumeri","Maiduguri","Marte","Mobbar","Monguno","Ngala","Nganzai","Shani"],
  CR: ["Abi","Akamkpa","Akpabuyo","Bakassi","Bekwarra","Biase","Boki","Calabar Municipal","Calabar South","Etung","Ikom","Obanliku","Obubra","Obudu","Odukpani","Ogoja","Yakurr","Yala"],
  DL: ["Aniocha North","Aniocha South","Bomadi","Burutu","Ethiope East","Ethiope West","Ika North East","Ika South","Isoko North","Isoko South","Ndokwa East","Ndokwa West","Okpe","Oshimili North","Oshimili South","Patani","Sapele","Udu","Ughelli North","Ughelli South","Ukwuani","Uvwie","Warri North","Warri South","Warri South West"],
  EB: ["Abakaliki","Afikpo North","Afikpo South","Ebonyi","Ezza North","Ezza South","Ikwo","Ishielu","Ivo","Izzi","Ohaozara","Ohaukwu","Onicha"],
  ED: ["Akoko-Edo","Egor","Esan Central","Esan North-East","Esan South-East","Esan West","Etsako Central","Etsako East","Etsako West","Igueben","Ikpoba-Okha","Orhionmwon","Oredo","Ovia North-East","Ovia South-West","Owan East","Owan West","Uhunmwonde"],
  EK: ["Ado Ekiti","Efon","Ekiti East","Ekiti South-West","Ekiti West","Emure","Gbonyin","Ido-Osi","Ijero","Ikere","Ikole","Ilejemeje","Irepodun/Ifelodun","Ise/Orun","Moba","Oye"],
  EN: ["Aninri","Awgu","Enugu East","Enugu North","Enugu South","Ezeagu","Igbo Etiti","Igbo Eze North","Igbo Eze South","Isi Uzo","Nkanu East","Nkanu West","Nsukka","Oji River","Udenu","Udi","Uzo Uwani"],
  FC: ["Abaji","Bwari","Gwagwalada","Kuje","Kwali","Municipal Area Council"],
  GO: ["Akko","Balanga","Billiri","Dukku","Funakaye","Gombe","Kaltungo","Kwami","Nafada","Shomgom","Yamaltu/Deba"],
  IM: ["Aboh Mbaise","Ahiazu Mbaise","Ehime Mbano","Ezinihitte","Ideato North","Ideato South","Ihitte/Uboma","Ikeduru","Isiala Mbano","Isu","Mbaitoli","Ngor Okpala","Njaba","Nkwerre","Nwangele","Obowo","Oguta","Ohaji/Egbema","Okigwe","Orlu","Orsu","Oru East","Oru West","Owerri Municipal","Owerri North","Owerri West","Unuimo"],
  JI: ["Auyo","Babura","Biriniwa","Birnin Kudu","Buji","Dutse","Gagarawa","Garki","Gumel","Guri","Gwaram","Gwiwa","Hadejia","Jahun","Kafin Hausa","Kaugama","Kazaure","Kiri Kasamma","Kiyawa","Maigatari","Malam Madori","Miga","Ringim","Roni","Sule Tankarkar","Taura","Yankwashi"],
  KD: ["Birnin Gwari","Chikun","Giwa","Igabi","Ikara","Jaba","Jema'a","Kachia","Kaduna North","Kaduna South","Kagarko","Kajuru","Kaura","Kauru","Kubau","Kudan","Lere","Makarfi","Sabon Gari","Sanga","Soba","Zangon Kataf","Zaria"],
  KN: ["Ajingi","Albasu","Bagwai","Bebeji","Bichi","Bunkure","Dala","Dambatta","Dawakin Kudu","Dawakin Tofa","Doguwa","Fagge","Gabasawa","Garko","Garun Mallam","Gaya","Gezawa","Gwale","Gwarzo","Kabo","Kano Municipal","Karaye","Kibiya","Kiru","Kumbotso","Kunchi","Kura","Madobi","Makoda","Minjibir","Nasarawa","Rano","Rimin Gado","Rogo","Shanono","Sumaila","Takai","Tarauni","Tofa","Tsanyawa","Tudun Wada","Ungogo","Warawa","Wudil"],
  KT: ["Bakori","Batagarawa","Batsari","Baure","Bindawa","Charanchi","Dan Musa","Dandume","Danja","Daura","Dutsi","Dutsin-Ma","Faskari","Funtua","Ingawa","Jibia","Kafur","Kaita","Kankara","Kankia","Katsina","Kurfi","Kusada","Mai'Adua","Malumfashi","Mani","Mashi","Matazu","Musawa","Rimi","Sabuwa","Safana","Sandamu","Zango"],
  KB: ["Aleiro","Arewa Dandi","Argungu","Augie","Bagudo","Birnin Kebbi","Bunza","Dandi","Fakai","Gwandu","Jega","Kalgo","Koko/Besse","Maiyama","Ngaski","Sakaba","Shanga","Suru","Wasagu/Danko","Yauri","Zuru"],
  KO: ["Adavi","Ajaokuta","Ankpa","Bassa","Dekina","Ibaji","Idah","Igalamela-Odolu","Ijumu","Kabba/Bunu","Kogi","Lokoja","Mopa-Muro","Ofu","Ogori/Magongo","Okehi","Okene","Olamaboro","Omala","Yagba East","Yagba West"],
  KW: ["Asa","Baruten","Edu","Ekiti","Ifelodun","Ilorin East","Ilorin South","Ilorin West","Irepodun","Isin","Kaiama","Moro","Offa","Oke-Ero","Oyun","Pategi"],
  LA: ["Agege","Ajeromi-Ifelodun","Alimosho","Amuwo-Odofin","Apapa","Badagry","Epe","Eti-Osa","Ibeju-Lekki","Ifako-Ijaiye","Ikeja","Ikorodu","Kosofe","Lagos Island","Lagos Mainland","Mushin","Ojo","Oshodi-Isolo","Somolu","Surulere"],
  NA: ["Akwanga","Awe","Doma","Karu","Keana","Keffi","Kokona","Lafia","Nasarawa","Nasarawa Egon","Obi","Toto","Wamba"],
  NI: ["Agaie","Agwara","Bida","Borgu","Bosso","Chanchaga","Edati","Gbako","Gurara","Katcha","Kontagora","Lapai","Lavun","Magama","Mariga","Mashegu","Mokwa","Moya","Paikoro","Rafi","Rijau","Shiroro","Suleja","Tafa","Wushishi"],
  OG: ["Abeokuta North","Abeokuta South","Ado-Odo/Ota","Egbado North","Egbado South","Ewekoro","Ifo","Ijebu East","Ijebu North","Ijebu North East","Ijebu Ode","Ikenne","Imeko Afon","Ipokia","Obafemi Owode","Odeda","Odogbolu","Ogun Waterside","Remo North","Sagamu"],
  ON: ["Akoko North-East","Akoko North-West","Akoko South-East","Akoko South-West","Akure North","Akure South","Ese Odo","Idanre","Ifedore","Ilaje","Ile Oluji/Okeigbo","Irele","Odigbo","Okitipupa","Ondo East","Ondo West","Ose","Owo"],
  OS: ["Aiyedade","Aiyedire","Atakunmosa East","Atakunmosa West","Boluwaduro","Boripe","Ede North","Ede South","Egbedore","Ejigbo","Ife Central","Ife East","Ife North","Ife South","Ifedayo","Ifelodun","Ila","Ilesa East","Ilesa West","Irepodun","Irewole","Isokan","Iwo","Obokun","Odo Otin","Ola Oluwa","Olorunda","Oriade","Orolu","Osogbo"],
  OY: ["Afijio","Akinyele","Atiba","Atisbo","Egbeda","Ibadan North","Ibadan North-East","Ibadan North-West","Ibadan South-East","Ibadan South-West","Ibarapa Central","Ibarapa East","Ibarapa North","Ido","Irepo","Iseyin","Itesiwaju","Iwajowa","Kajola","Lagelu","Ogbomosho North","Ogbomosho South","Ogo Oluwa","Olorunsogo","Oluyole","Ona Ara","Orelope","Ori Ire","Oyo East","Oyo West","Saki East","Saki West","Surulere"],
  PL: ["Barkin Ladi","Bassa","Bokkos","Jos East","Jos North","Jos South","Kanam","Kanke","Langtang North","Langtang South","Mangu","Mikang","Pankshin","Qua'an Pan","Riyom","Shendam","Wase"],
  RV: ["Abua/Odual","Ahoada East","Ahoada West","Akuku-Toru","Andoni","Asari-Toru","Bonny","Degema","Eleme","Emohua","Etche","Gokana","Ikwerre","Khana","Obio/Akpor","Ogba/Egbema/Ndoni","Ogu/Bolo","Okrika","Omuma","Opobo/Nkoro","Oyigbo","Port Harcourt","Tai"],
  SO: ["Binji","Bodinga","Dange Shuni","Gada","Goronyo","Gudu","Gwadabawa","Illela","Isa","Kebbe","Kware","Rabah","Sabon Birni","Shagari","Silame","Sokoto North","Sokoto South","Tambuwal","Tangaza","Tureta","Wamako","Wurno","Yabo"],
  TA: ["Ardo Kola","Bali","Donga","Gashaka","Gassol","Ibi","Jalingo","Karim Lamido","Kumi","Lau","Sardauna","Takum","Ussa","Wukari","Yorro","Zing"],
  YO: ["Bade","Bursari","Damaturu","Fika","Fune","Geidam","Gujba","Gulani","Jakusko","Karasuwa","Machina","Nangere","Nguru","Potiskum","Tarmuwa","Yunusari","Yusufari"],
  ZA: ["Anka","Bakura","Birnin Magaji/Kiyaw","Bukkuyum","Bungudu","Gummi","Gusau","Kaura Namoda","Maradun","Maru","Shinkafi","Talata Mafara","Tsafe","Zurmi"],
};

// ─── State-level votes from setup.sql presidential_2023 ──────────────────────
// Only 4 parties (APC, PDP, LP, NNPP) — OTHERS is excluded from LGA seed

const STATE_VOTES = {
  AB: { APC: 8228,   PDP: 10473,  LP: 150312, NNPP: 756,   accredited: 172271,  total_pus: 3672,  reported_pus: 3672 },
  AD: { APC: 189744, PDP: 265422, LP: 25019,  NNPP: 7826,  accredited: 493901,  total_pus: 4015,  reported_pus: 4015 },
  AK: { APC: 85531,  PDP: 310001, LP: 55049,  NNPP: 4805,  accredited: 461596,  total_pus: 5479,  reported_pus: 5479 },
  AN: { APC: 15462,  PDP: 24994,  LP: 395318, NNPP: 4578,  accredited: 443802,  total_pus: 5720,  reported_pus: 5720 },
  BA: { APC: 388689, PDP: 220819, LP: 25090,  NNPP: 32459, accredited: 675707,  total_pus: 5029,  reported_pus: 5029 },
  BY: { APC: 60318,  PDP: 185219, LP: 32474,  NNPP: 2045,  accredited: 283271,  total_pus: 1576,  reported_pus: 1576 },
  BE: { APC: 240215, PDP: 185419, LP: 160025, NNPP: 10264, accredited: 601153,  total_pus: 4844,  reported_pus: 4844 },
  BO: { APC: 487543, PDP: 155019, LP: 20015,  NNPP: 15342, accredited: 684459,  total_pus: 5765,  reported_pus: 5765 },
  CR: { APC: 95218,  PDP: 193459, LP: 54819,  NNPP: 7826,  accredited: 355642,  total_pus: 3769,  reported_pus: 3769 },
  DL: { APC: 100001, PDP: 335614, LP: 110004, NNPP: 11826, accredited: 563985,  total_pus: 5756,  reported_pus: 5756 },
  EB: { APC: 29318,  PDP: 35219,  LP: 184528, NNPP: 3045,  accredited: 254260,  total_pus: 3673,  reported_pus: 3673 },
  ED: { APC: 110218, PDP: 275616, LP: 90015,  NNPP: 10642, accredited: 491921,  total_pus: 4026,  reported_pus: 4026 },
  EK: { APC: 160318, PDP: 54219,  LP: 34019,  NNPP: 3045,  accredited: 253941,  total_pus: 2774,  reported_pus: 2774 },
  EN: { APC: 20018,  PDP: 40019,  LP: 319558, NNPP: 4235,  accredited: 386950,  total_pus: 4448,  reported_pus: 4448 },
  FC: { APC: 90215,  PDP: 65218,  LP: 185019, NNPP: 14826, accredited: 359598,  total_pus: 3201,  reported_pus: 3201 },
  GO: { APC: 220217, PDP: 150019, LP: 20015,  NNPP: 15826, accredited: 410287,  total_pus: 2654,  reported_pus: 2654 },
  IM: { APC: 50218,  PDP: 55219,  LP: 325428, NNPP: 7826,  accredited: 443011,  total_pus: 5065,  reported_pus: 5065 },
  JI: { APC: 480318, PDP: 100219, LP: 15019,  NNPP: 42015, accredited: 642801,  total_pus: 5459,  reported_pus: 5459 },
  KD: { APC: 475219, PDP: 265418, LP: 160015, NNPP: 100015, accredited: 1009317, total_pus: 7681, reported_pus: 7681 },
  KN: { APC: 310015, PDP: 170218, LP: 55215,  NNPP: 630019, accredited: 1178007, total_pus: 14844, reported_pus: 14844 },
  KT: { APC: 530218, PDP: 170018, LP: 25015,  NNPP: 65215, accredited: 799006,  total_pus: 6942,  reported_pus: 6942 },
  KB: { APC: 330215, PDP: 95218,  LP: 10015,  NNPP: 15215, accredited: 454873,  total_pus: 3718,  reported_pus: 3718 },
  KO: { APC: 285318, PDP: 115218, LP: 65015,  NNPP: 10215, accredited: 479976,  total_pus: 4220,  reported_pus: 4220 },
  KW: { APC: 240215, PDP: 110219, LP: 55015,  NNPP: 12215, accredited: 420874,  total_pus: 3344,  reported_pus: 3344 },
  LA: { APC: 572606, PDP: 75750,  LP: 582454, NNPP: 14068, accredited: 1253418, total_pus: 13325, reported_pus: 13325 },
  NA: { APC: 215218, PDP: 125219, LP: 100015, NNPP: 10215, accredited: 453877,  total_pus: 3021,  reported_pus: 3021 },
  NI: { APC: 410215, PDP: 155219, LP: 65015,  NNPP: 20215, accredited: 656094,  total_pus: 5215,  reported_pus: 5215 },
  OG: { APC: 285218, PDP: 85219,  LP: 165015, NNPP: 8215,  accredited: 547987,  total_pus: 5002,  reported_pus: 5002 },
  ON: { APC: 310215, PDP: 90218,  LP: 115015, NNPP: 8215,  accredited: 527873,  total_pus: 4239,  reported_pus: 4239 },
  OS: { APC: 325215, PDP: 100218, LP: 85015,  NNPP: 8215,  accredited: 522873,  total_pus: 4083,  reported_pus: 4083 },
  OY: { APC: 365215, PDP: 155218, LP: 185015, NNPP: 10215, accredited: 721093,  total_pus: 6090,  reported_pus: 6090 },
  PL: { APC: 200215, PDP: 150218, LP: 295015, NNPP: 15215, accredited: 664873,  total_pus: 5065,  reported_pus: 5065 },
  RV: { APC: 50215,  PDP: 175218, LP: 450015, NNPP: 10215, accredited: 691093,  total_pus: 5220,  reported_pus: 5220 },
  SO: { APC: 400215, PDP: 165218, LP: 15015,  NNPP: 20215, accredited: 604873,  total_pus: 5683,  reported_pus: 5683 },
  TA: { APC: 155215, PDP: 230218, LP: 55015,  NNPP: 10215, accredited: 453873,  total_pus: 3660,  reported_pus: 3660 },
  YO: { APC: 310215, PDP: 90218,  LP: 10015,  NNPP: 10215, accredited: 423873,  total_pus: 3139,  reported_pus: 3139 },
  ZA: { APC: 320215, PDP: 110218, LP: 15015,  NNPP: 20215, accredited: 469873,  total_pus: 4015,  reported_pus: 4015 },
};

const PARTIES = ['APC', 'PDP', 'LP', 'NNPP'];

// ─── Escape single quotes in LGA names ───────────────────────────────────────

function esc(s) {
  return s.replace(/'/g, "''");
}

// ─── Generate INSERT rows ─────────────────────────────────────────────────────

const lines = [];

lines.push(`-- =============================================================================`);
lines.push(`-- LGA-level presidential_2023 seed — generated by scripts/gen-lga-seed.js`);
lines.push(`-- 774 LGAs × 4 parties = 3,096 rows`);
lines.push(`-- Votes are distributed equally per LGA (floor division; remainder to first LGA)`);
lines.push(`-- =============================================================================`);
lines.push(``);
lines.push(`INSERT INTO ng_election_lga_results`);
lines.push(`  (election_id, state_code, lga_name, party_code, votes, accredited_voters, total_pus, reported_pus, status, over_voted)`);
lines.push(`VALUES`);

const rows = [];

for (const [stateCode, lgas] of Object.entries(LGA_MAP)) {
  const sv = STATE_VOTES[stateCode];
  if (!sv) {
    console.error(`No state vote data for ${stateCode}`);
    process.exit(1);
  }
  const n = lgas.length;

  // Per-LGA scalar fields
  const accPerLga   = Math.floor(sv.accredited   / n);
  const accRemainder = sv.accredited   - accPerLga * n;
  const pusPerLga   = Math.floor(sv.total_pus    / n);
  const pusRemainder = sv.total_pus    - pusPerLga * n;

  for (let i = 0; i < lgas.length; i++) {
    const lgaName = lgas[i];
    const isFirst = i === 0;
    const acc  = isFirst ? accPerLga + accRemainder : accPerLga;
    const pus  = isFirst ? pusPerLga + pusRemainder  : pusPerLga;

    for (const party of PARTIES) {
      const stateVotes = sv[party];
      const baseVotes  = Math.floor(stateVotes / n);
      const remainder  = stateVotes - baseVotes * n;
      const lgaVotes   = isFirst ? baseVotes + remainder : baseVotes;

      rows.push(
        `('presidential_2023','${stateCode}','${esc(lgaName)}','${party}',${lgaVotes},${acc},${pus},${pus},'declared',false)`
      );
    }
  }
}

lines.push(rows.join(',\n'));
lines.push(`ON CONFLICT (election_id, state_code, lga_name, party_code) DO NOTHING;`);
lines.push(``);
lines.push(`-- Done. ${rows.length} rows generated.`);

const sql = lines.join('\n');

const outPath = path.join(__dirname, '..', 'supabase', 'seed_lga_2023.sql');
fs.writeFileSync(outPath, sql, 'utf8');

console.log(`Written: ${outPath}`);
console.log(`Total rows: ${rows.length} (expected 3096)`);

// Sanity check
const totalLGAs = Object.values(LGA_MAP).reduce((s, v) => s + v.length, 0);
console.log(`Total LGAs: ${totalLGAs} (expected 774)`);
