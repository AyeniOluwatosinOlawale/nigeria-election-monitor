import type { Party, NigeriaState, SenatorialDistrict, Zone } from "./types";

// INEC-registered parties as of February 2026 (21 total)
// * = court-ordered deregistration pending
// Logo URLs: Wikipedia Special:FilePath redirects to Wikimedia CDN
const WP = "https://en.wikipedia.org/wiki/Special:FilePath/";
export const PARTIES: Party[] = [
  { code: "APC",  name: "All Progressives Congress",       color: "#1E40AF", shortName: "APC",    logo: `${WP}All_Progressives_Congress_logo.png`           },
  { code: "PDP",  name: "Peoples Democratic Party",        color: "#DC2626", shortName: "PDP",    logo: `${WP}Peoples_Democratic_Party_(Nigeria)_logo.png`  },
  { code: "LP",   name: "Labour Party",                    color: "#16A34A", shortName: "LP",     logo: `${WP}Labour_Party_Nigeria_logo.png`                },
  { code: "NNPP", name: "New Nigeria Peoples Party",       color: "#D97706", shortName: "NNPP",   logo: `${WP}New_Nigeria_Peoples_Party_logo.png`           },
  { code: "SDP",  name: "Social Democratic Party",         color: "#0891B2", shortName: "SDP",    logo: `${WP}Social_Democratic_Party_Nigeria_logo.png`     },
  { code: "APGA", name: "All Progressives Grand Alliance", color: "#F59E0B", shortName: "APGA",   logo: `${WP}All_Progressives_Grand_Alliance_logo.png`     },
  { code: "YPP",  name: "Young Progressives Party",        color: "#EC4899", shortName: "YPP",    logo: `${WP}Young_Progressives_Party_Nigeria_logo.png`    },
  { code: "PRP",  name: "Peoples Redemption Party",        color: "#059669", shortName: "PRP",    logo: `${WP}Peoples_Redemption_Party_Nigeria_logo.png`    },
  { code: "NRM",  name: "National Rescue Movement",        color: "#8B5CF6", shortName: "NRM"  },
  { code: "BP",   name: "Boot Party",                      color: "#06B6D4", shortName: "BP"   },
  { code: "ADP",  name: "Action Democratic Party",         color: "#7C3AED", shortName: "ADP",    logo: `${WP}Action_Democratic_Party_Nigeria_logo.png`     },
  { code: "AAC",  name: "African Action Congress",         color: "#BE185D", shortName: "AAC",    logo: `${WP}African_Action_Congress_logo.png`             },
  { code: "APM",  name: "Allied Peoples Movement",         color: "#B45309", shortName: "APM"  },
  { code: "YP",   name: "Youth Party",                     color: "#0D9488", shortName: "YP"   },
  { code: "DLA",  name: "Democratic Leadership Alliance",  color: "#6366F1", shortName: "DLA"  },
  // Deregistration pending — court orders, INEC appeal ongoing
  { code: "ADC",  name: "African Democratic Congress *",   color: "#64748B", shortName: "ADC",    logo: `${WP}African_Democratic_Congress_Nigeria_logo.png` },
  { code: "A",    name: "Accord *",                        color: "#78716C", shortName: "A",      logo: `${WP}Accord_Party_Nigeria_logo.png`                },
  { code: "AA",   name: "Action Alliance *",               color: "#71717A", shortName: "AA",     logo: `${WP}Action_Alliance_Nigeria_logo.png`             },
  { code: "ZLP",  name: "Zenith Labour Party *",           color: "#6B7280", shortName: "ZLP",    logo: `${WP}Zenith_Labour_Party_logo.png`                 },
  { code: "APP",  name: "Action Peoples Party *",          color: "#A8A29E", shortName: "APP"  },
  { code: "NDC",  name: "Nigeria Democratic Congress *",   color: "#9CA3AF", shortName: "NDC"  },
  { code: "OTHERS", name: "Other Parties",                 color: "#D1D5DB", shortName: "Others" },
];

export const PARTY_MAP: Record<string, Party> = Object.fromEntries(
  PARTIES.map((p) => [p.code, p])
);

export const STATES: NigeriaState[] = [
  // North West (7)
  {
    code: "SO", name: "Sokoto", zone: "NW", capital: "Sokoto", lgas: 23, registeredVoters: 2100000,
    lgaNames: ["Binji","Bodinga","Dange Shuni","Gada","Goronyo","Gudu","Gwadabawa","Illela","Isa","Kebbe","Kware","Rabah","Sabon Birni","Shagari","Silame","Sokoto North","Sokoto South","Tambuwal","Tangaza","Tureta","Wamako","Wurno","Yabo"],
  },
  {
    code: "KB", name: "Kebbi", zone: "NW", capital: "Birnin Kebbi", lgas: 21, registeredVoters: 1900000,
    lgaNames: ["Aleiro","Arewa Dandi","Argungu","Augie","Bagudo","Birnin Kebbi","Bunza","Dandi","Fakai","Gwandu","Jega","Kalgo","Koko/Besse","Maiyama","Ngaski","Sakaba","Shanga","Suru","Wasagu/Danko","Yauri","Zuru"],
  },
  {
    code: "ZA", name: "Zamfara", zone: "NW", capital: "Gusau", lgas: 14, registeredVoters: 1800000,
    lgaNames: ["Anka","Bakura","Birnin Magaji/Kiyaw","Bukkuyum","Bungudu","Gummi","Gusau","Kaura Namoda","Maradun","Maru","Shinkafi","Talata Mafara","Tsafe","Zurmi"],
  },
  {
    code: "KT", name: "Katsina", zone: "NW", capital: "Katsina", lgas: 34, registeredVoters: 3200000,
    lgaNames: ["Bakori","Batagarawa","Batsari","Baure","Bindawa","Charanchi","Dan Musa","Dandume","Danja","Daura","Dutsi","Dutsin-Ma","Faskari","Funtua","Ingawa","Jibia","Kafur","Kaita","Kankara","Kankia","Katsina","Kurfi","Kusada","Mai'Adua","Malumfashi","Mani","Mashi","Matazu","Musawa","Rimi","Sabuwa","Safana","Sandamu","Zango"],
  },
  {
    code: "KN", name: "Kano", zone: "NW", capital: "Kano", lgas: 44, registeredVoters: 5800000,
    lgaNames: ["Ajingi","Albasu","Bagwai","Bebeji","Bichi","Bunkure","Dala","Dambatta","Dawakin Kudu","Dawakin Tofa","Doguwa","Fagge","Gabasawa","Garko","Garun Mallam","Gaya","Gezawa","Gwale","Gwarzo","Kabo","Kano Municipal","Karaye","Kibiya","Kiru","Kumbotso","Kunchi","Kura","Madobi","Makoda","Minjibir","Nasarawa","Rano","Rimin Gado","Rogo","Shanono","Sumaila","Takai","Tarauni","Tofa","Tsanyawa","Tudun Wada","Ungogo","Warawa","Wudil"],
  },
  {
    code: "JI", name: "Jigawa", zone: "NW", capital: "Dutse", lgas: 27, registeredVoters: 2200000,
    lgaNames: ["Auyo","Babura","Biriniwa","Birnin Kudu","Buji","Dutse","Gagarawa","Garki","Gumel","Guri","Gwaram","Gwiwa","Hadejia","Jahun","Kafin Hausa","Kaugama","Kazaure","Kiri Kasamma","Kiyawa","Maigatari","Malam Madori","Miga","Ringim","Roni","Sule Tankarkar","Taura","Yankwashi"],
  },
  {
    code: "KD", name: "Kaduna", zone: "NW", capital: "Kaduna", lgas: 23, registeredVoters: 3900000,
    lgaNames: ["Birnin Gwari","Chikun","Giwa","Igabi","Ikara","Jaba","Jema'a","Kachia","Kaduna North","Kaduna South","Kagarko","Kajuru","Kaura","Kauru","Kubau","Kudan","Lere","Makarfi","Sabon Gari","Sanga","Soba","Zangon Kataf","Zaria"],
  },
  // North East (6)
  {
    code: "BO", name: "Borno", zone: "NE", capital: "Maiduguri", lgas: 27, registeredVoters: 2400000,
    lgaNames: ["Abadam","Askira/Uba","Bama","Bayo","Biu","Chibok","Damboa","Dikwa","Gubio","Guzamala","Gwoza","Hawul","Jere","Kaga","Kala/Balge","Konduga","Kukawa","Kwaya Kusar","Mafa","Magumeri","Maiduguri","Marte","Mobbar","Monguno","Ngala","Nganzai","Shani"],
  },
  {
    code: "YO", name: "Yobe", zone: "NE", capital: "Damaturu", lgas: 17, registeredVoters: 1300000,
    lgaNames: ["Bade","Bursari","Damaturu","Fika","Fune","Geidam","Gujba","Gulani","Jakusko","Karasuwa","Machina","Nangere","Nguru","Potiskum","Tarmuwa","Yunusari","Yusufari"],
  },
  {
    code: "AD", name: "Adamawa", zone: "NE", capital: "Yola", lgas: 21, registeredVoters: 1900000,
    lgaNames: ["Demsa","Fufore","Ganye","Girei","Gombi","Guyuk","Hong","Jada","Lamurde","Madagali","Maiha","Mayo-Belwa","Michika","Mubi North","Mubi South","Numan","Shelleng","Song","Toungo","Yola North","Yola South"],
  },
  {
    code: "GO", name: "Gombe", zone: "NE", capital: "Gombe", lgas: 11, registeredVoters: 1200000,
    lgaNames: ["Akko","Balanga","Billiri","Dukku","Funakaye","Gombe","Kaltungo","Kwami","Nafada","Shomgom","Yamaltu/Deba"],
  },
  {
    code: "BA", name: "Bauchi", zone: "NE", capital: "Bauchi", lgas: 20, registeredVoters: 2300000,
    lgaNames: ["Alkaleri","Bauchi","Bogoro","Damban","Darazo","Dass","Gamawa","Ganjuwa","Giade","Itas/Gadau","Jama'are","Katagum","Kirfi","Misau","Ningi","Shira","Tafawa Balewa","Toro","Warji","Zaki"],
  },
  {
    code: "TA", name: "Taraba", zone: "NE", capital: "Jalingo", lgas: 16, registeredVoters: 1500000,
    lgaNames: ["Ardo Kola","Bali","Donga","Gashaka","Gassol","Ibi","Jalingo","Karim Lamido","Kumi","Lau","Sardauna","Takum","Ussa","Wukari","Yorro","Zing"],
  },
  // North Central (7)
  {
    code: "NI", name: "Niger", zone: "NC", capital: "Minna", lgas: 25, registeredVoters: 2500000,
    lgaNames: ["Agaie","Agwara","Bida","Borgu","Bosso","Chanchaga","Edati","Gbako","Gurara","Katcha","Kontagora","Lapai","Lavun","Magama","Mariga","Mashegu","Mokwa","Moya","Paikoro","Rafi","Rijau","Shiroro","Suleja","Tafa","Wushishi"],
  },
  {
    code: "KW", name: "Kwara", zone: "NC", capital: "Ilorin", lgas: 16, registeredVoters: 1700000,
    lgaNames: ["Asa","Baruten","Edu","Ekiti","Ifelodun","Ilorin East","Ilorin South","Ilorin West","Irepodun","Isin","Kaiama","Moro","Offa","Oke-Ero","Oyun","Pategi"],
  },
  {
    code: "FC", name: "FCT", zone: "NC", capital: "Abuja", lgas: 6, registeredVoters: 1900000,
    lgaNames: ["Abaji","Bwari","Gwagwalada","Kuje","Kwali","Municipal Area Council"],
  },
  {
    code: "KO", name: "Kogi", zone: "NC", capital: "Lokoja", lgas: 21, registeredVoters: 2000000,
    lgaNames: ["Adavi","Ajaokuta","Ankpa","Bassa","Dekina","Ibaji","Idah","Igalamela-Odolu","Ijumu","Kabba/Bunu","Kogi","Lokoja","Mopa-Muro","Ofu","Ogori/Magongo","Okehi","Okene","Olamaboro","Omala","Yagba East","Yagba West"],
  },
  {
    code: "NA", name: "Nasarawa", zone: "NC", capital: "Lafia", lgas: 13, registeredVoters: 1300000,
    lgaNames: ["Akwanga","Awe","Doma","Karu","Keana","Keffi","Kokona","Lafia","Nasarawa","Nasarawa Egon","Obi","Toto","Wamba"],
  },
  {
    code: "PL", name: "Plateau", zone: "NC", capital: "Jos", lgas: 17, registeredVoters: 2200000,
    lgaNames: ["Barkin Ladi","Bassa","Bokkos","Jos East","Jos North","Jos South","Kanam","Kanke","Langtang North","Langtang South","Mangu","Mikang","Pankshin","Qua'an Pan","Riyom","Shendam","Wase"],
  },
  {
    code: "BE", name: "Benue", zone: "NC", capital: "Makurdi", lgas: 23, registeredVoters: 2500000,
    lgaNames: ["Ado","Agatu","Apa","Buruku","Gboko","Guma","Gwer East","Gwer West","Katsina-Ala","Konshisha","Kwande","Logo","Makurdi","Obi","Ogbadibo","Ohimini","Oju","Okpokwu","Otukpo","Tarka","Ukum","Ushongo","Vandeikya"],
  },
  // South West (6)
  {
    code: "LA", name: "Lagos", zone: "SW", capital: "Lagos", lgas: 20, registeredVoters: 7600000,
    lgaNames: ["Agege","Ajeromi-Ifelodun","Alimosho","Amuwo-Odofin","Apapa","Badagry","Epe","Eti-Osa","Ibeju-Lekki","Ifako-Ijaiye","Ikeja","Ikorodu","Kosofe","Lagos Island","Lagos Mainland","Mushin","Ojo","Oshodi-Isolo","Somolu","Surulere"],
  },
  {
    code: "OG", name: "Ogun", zone: "SW", capital: "Abeokuta", lgas: 20, registeredVoters: 2300000,
    lgaNames: ["Abeokuta North","Abeokuta South","Ado-Odo/Ota","Egbado North","Egbado South","Ewekoro","Ifo","Ijebu East","Ijebu North","Ijebu North East","Ijebu Ode","Ikenne","Imeko Afon","Ipokia","Obafemi Owode","Odeda","Odogbolu","Ogun Waterside","Remo North","Sagamu"],
  },
  {
    code: "OY", name: "Oyo", zone: "SW", capital: "Ibadan", lgas: 33, registeredVoters: 3200000,
    lgaNames: ["Afijio","Akinyele","Atiba","Atisbo","Egbeda","Ibadan North","Ibadan North-East","Ibadan North-West","Ibadan South-East","Ibadan South-West","Ibarapa Central","Ibarapa East","Ibarapa North","Ido","Irepo","Iseyin","Itesiwaju","Iwajowa","Kajola","Lagelu","Ogbomosho North","Ogbomosho South","Ogo Oluwa","Olorunsogo","Oluyole","Ona Ara","Orelope","Ori Ire","Oyo East","Oyo West","Saki East","Saki West","Surulere"],
  },
  {
    code: "OS", name: "Osun", zone: "SW", capital: "Osogbo", lgas: 30, registeredVoters: 1900000,
    lgaNames: ["Aiyedade","Aiyedire","Atakunmosa East","Atakunmosa West","Boluwaduro","Boripe","Ede North","Ede South","Egbedore","Ejigbo","Ife Central","Ife East","Ife North","Ife South","Ifedayo","Ifelodun","Ila","Ilesa East","Ilesa West","Irepodun","Irewole","Isokan","Iwo","Obokun","Odo Otin","Ola Oluwa","Olorunda","Oriade","Orolu","Osogbo"],
  },
  {
    code: "ON", name: "Ondo", zone: "SW", capital: "Akure", lgas: 18, registeredVoters: 1800000,
    lgaNames: ["Akoko North-East","Akoko North-West","Akoko South-East","Akoko South-West","Akure North","Akure South","Ese Odo","Idanre","Ifedore","Ilaje","Ile Oluji/Okeigbo","Irele","Odigbo","Okitipupa","Ondo East","Ondo West","Ose","Owo"],
  },
  {
    code: "EK", name: "Ekiti", zone: "SW", capital: "Ado Ekiti", lgas: 16, registeredVoters: 1000000,
    lgaNames: ["Ado Ekiti","Efon","Ekiti East","Ekiti South-West","Ekiti West","Emure","Gbonyin","Ido-Osi","Ijero","Ikere","Ikole","Ilejemeje","Irepodun/Ifelodun","Ise/Orun","Moba","Oye"],
  },
  // South South (6)
  {
    code: "RV", name: "Rivers", zone: "SS", capital: "Port Harcourt", lgas: 23, registeredVoters: 3300000,
    lgaNames: ["Abua/Odual","Ahoada East","Ahoada West","Akuku-Toru","Andoni","Asari-Toru","Bonny","Degema","Eleme","Emohua","Etche","Gokana","Ikwerre","Khana","Obio/Akpor","Ogba/Egbema/Ndoni","Ogu/Bolo","Okrika","Omuma","Opobo/Nkoro","Oyigbo","Port Harcourt","Tai"],
  },
  {
    code: "DL", name: "Delta", zone: "SS", capital: "Asaba", lgas: 25, registeredVoters: 2700000,
    lgaNames: ["Aniocha North","Aniocha South","Bomadi","Burutu","Ethiope East","Ethiope West","Ika North East","Ika South","Isoko North","Isoko South","Ndokwa East","Ndokwa West","Okpe","Oshimili North","Oshimili South","Patani","Sapele","Udu","Ughelli North","Ughelli South","Ukwuani","Uvwie","Warri North","Warri South","Warri South West"],
  },
  {
    code: "ED", name: "Edo", zone: "SS", capital: "Benin City", lgas: 18, registeredVoters: 2200000,
    lgaNames: ["Akoko-Edo","Egor","Esan Central","Esan North-East","Esan South-East","Esan West","Etsako Central","Etsako East","Etsako West","Igueben","Ikpoba-Okha","Orhionmwon","Oredo","Ovia North-East","Ovia South-West","Owan East","Owan West","Uhunmwonde"],
  },
  {
    code: "BY", name: "Bayelsa", zone: "SS", capital: "Yenagoa", lgas: 8, registeredVoters: 950000,
    lgaNames: ["Brass","Ekeremor","Kolokuma/Opokuma","Nembe","Ogbia","Sagbama","Southern Ijaw","Yenagoa"],
  },
  {
    code: "CR", name: "Cross River", zone: "SS", capital: "Calabar", lgas: 18, registeredVoters: 1700000,
    lgaNames: ["Abi","Akamkpa","Akpabuyo","Bakassi","Bekwarra","Biase","Boki","Calabar Municipal","Calabar South","Etung","Ikom","Obanliku","Obubra","Obudu","Odukpani","Ogoja","Yakurr","Yala"],
  },
  {
    code: "AK", name: "Akwa Ibom", zone: "SS", capital: "Uyo", lgas: 31, registeredVoters: 2400000,
    lgaNames: ["Abak","Eastern Obolo","Eket","Esit Eket","Essien Udim","Etim Ekpo","Etinan","Ibeno","Ibesikpo Asutan","Ibiono-Ibom","Ika","Ikono","Ikot Abasi","Ikot Ekpene","Ini","Itu","Mbo","Mkpat Enin","Nsit Atai","Nsit Ibom","Nsit Ubium","Obot Akara","Okobo","Onna","Oron","Oruk Anam","Udung Uko","Ukanafun","Uruan","Urue-Offong/Oruko","Uyo"],
  },
  // South East (5)
  {
    code: "AN", name: "Anambra", zone: "SE", capital: "Awka", lgas: 21, registeredVoters: 2300000,
    lgaNames: ["Aguata","Anambra East","Anambra West","Anaocha","Awka North","Awka South","Ayamelum","Dunukofia","Ekwusigo","Idemili North","Idemili South","Ihiala","Njikoka","Nnewi North","Nnewi South","Ogbaru","Onitsha North","Onitsha South","Orumba North","Orumba South","Oyi"],
  },
  {
    code: "IM", name: "Imo", zone: "SE", capital: "Owerri", lgas: 27, registeredVoters: 2100000,
    lgaNames: ["Aboh Mbaise","Ahiazu Mbaise","Ehime Mbano","Ezinihitte","Ideato North","Ideato South","Ihitte/Uboma","Ikeduru","Isiala Mbano","Isu","Mbaitoli","Ngor Okpala","Njaba","Nkwerre","Nwangele","Obowo","Oguta","Ohaji/Egbema","Okigwe","Orlu","Orsu","Oru East","Oru West","Owerri Municipal","Owerri North","Owerri West","Unuimo"],
  },
  {
    code: "EN", name: "Enugu", zone: "SE", capital: "Enugu", lgas: 17, registeredVoters: 1900000,
    lgaNames: ["Aninri","Awgu","Enugu East","Enugu North","Enugu South","Ezeagu","Igbo Etiti","Igbo Eze North","Igbo Eze South","Isi Uzo","Nkanu East","Nkanu West","Nsukka","Oji River","Udenu","Udi","Uzo Uwani"],
  },
  {
    code: "AB", name: "Abia", zone: "SE", capital: "Umuahia", lgas: 17, registeredVoters: 1500000,
    lgaNames: ["Aba North","Aba South","Arochukwu","Bende","Ikwuano","Isiala Ngwa North","Isiala Ngwa South","Isuikwuato","Obi Ngwa","Ohafia","Osisioma Ngwa","Ugwunagbo","Ukwa East","Ukwa West","Umuahia North","Umuahia South","Umu Nneochi"],
  },
  {
    code: "EB", name: "Ebonyi", zone: "SE", capital: "Abakaliki", lgas: 13, registeredVoters: 1300000,
    lgaNames: ["Abakaliki","Afikpo North","Afikpo South","Ebonyi","Ezza North","Ezza South","Ikwo","Ishielu","Ivo","Izzi","Ohaozara","Ohaukwu","Onicha"],
  },
];

export const STATE_MAP: Record<string, NigeriaState> = Object.fromEntries(
  STATES.map((s) => [s.code, s])
);

export const ZONE_NAMES: Record<Zone, string> = {
  NW: "North West",
  NE: "North East",
  NC: "North Central",
  SW: "South West",
  SS: "South South",
  SE: "South East",
};

export const ZONE_COLORS: Record<Zone, string> = {
  NW: "#1D4ED8",
  NE: "#7C3AED",
  NC: "#059669",
  SW: "#D97706",
  SS: "#DC2626",
  SE: "#0891B2",
};

// Grid positions for Nigeria state cartogram (col 0-8, row 0-5)
export const STATE_GRID = [
  // Row 0 — Far North
  { code: "SO", col: 1, row: 0 }, { code: "KB", col: 2, row: 0 },
  { code: "ZA", col: 3, row: 0 }, { code: "KT", col: 4, row: 0 },
  { code: "KN", col: 5, row: 0 }, { code: "JI", col: 6, row: 0 },
  { code: "YO", col: 7, row: 0 }, { code: "BO", col: 8, row: 0 },
  // Row 1 — North scattered
  { code: "NI", col: 2, row: 1 }, { code: "KD", col: 4, row: 1 },
  { code: "BA", col: 6, row: 1 }, { code: "GO", col: 7, row: 1 },
  { code: "AD", col: 8, row: 1 },
  // Row 2 — Middle belt
  { code: "KW", col: 1, row: 2 }, { code: "FC", col: 3, row: 2 },
  { code: "NA", col: 4, row: 2 }, { code: "PL", col: 5, row: 2 },
  { code: "BE", col: 6, row: 2 }, { code: "TA", col: 7, row: 2 },
  // Row 3 — South transition
  { code: "LA", col: 0, row: 3 }, { code: "OG", col: 1, row: 3 },
  { code: "OY", col: 2, row: 3 }, { code: "KO", col: 3, row: 3 },
  { code: "DL", col: 5, row: 3 }, { code: "EN", col: 6, row: 3 },
  { code: "CR", col: 7, row: 3 },
  // Row 4 — South
  { code: "OS", col: 1, row: 4 }, { code: "EK", col: 2, row: 4 },
  { code: "ED", col: 3, row: 4 }, { code: "AN", col: 5, row: 4 },
  { code: "EB", col: 6, row: 4 }, { code: "AK", col: 7, row: 4 },
  // Row 5 — Coastal south
  { code: "ON", col: 2, row: 5 }, { code: "BY", col: 3, row: 5 },
  { code: "RV", col: 4, row: 5 }, { code: "IM", col: 5, row: 5 },
  { code: "AB", col: 6, row: 5 },
];

// Senatorial districts: 3 per state (North/Central/South or East/West/Central), 1 for FCT = 109
// Naming follows typical INEC patterns
const SENATE_SUFFIXES: Record<string, [string, string, string]> = {
  SO: ["East", "North", "South"],
  KB: ["North", "Central", "South"],
  ZA: ["Central", "North", "West"],
  KT: ["North", "Central", "South"],
  KN: ["North", "Central", "South"],
  JI: ["Central", "North-East", "North-West"],
  KD: ["North", "Central", "South"],
  BO: ["North", "Central", "South"],
  YO: ["East", "North", "South"],
  AD: ["North", "Central", "South"],
  GO: ["North", "Central", "South"],
  BA: ["North", "Central", "South"],
  TA: ["North", "Central", "South"],
  NI: ["North", "East", "South"],
  KW: ["North", "Central", "South"],
  KO: ["East", "Central", "West"],
  NA: ["North", "South", "West"],
  PL: ["Central", "North", "South"],
  BE: ["North-East", "North-West", "South"],
  LA: ["East", "Central", "West"],
  OG: ["East", "Central", "West"],
  OY: ["North", "Central", "South"],
  OS: ["East", "Central", "West"],
  ON: ["North", "Central", "South"],
  EK: ["North", "Central", "South"],
  RV: ["East", "South-East", "West"],
  DL: ["North", "Central", "South"],
  ED: ["North", "Central", "South"],
  BY: ["Central", "East", "West"],
  CR: ["North", "Central", "South"],
  AK: ["North-East", "North-West", "South"],
  AN: ["North", "Central", "South"],
  IM: ["East", "North", "West"],
  EN: ["East", "North", "West"],
  AB: ["North", "Central", "South"],
  EB: ["North", "Central", "South"],
};

export const SENATORIAL_DISTRICTS: SenatorialDistrict[] = [];

for (const state of STATES) {
  if (state.code === "FC") {
    // FCT has only 1 senator
    SENATORIAL_DISTRICTS.push({
      id: `FC-1`,
      name: "Abuja",
      stateCode: "FC",
    });
  } else {
    const suffixes = SENATE_SUFFIXES[state.code] || ["North", "Central", "South"];
    for (let i = 0; i < 3; i++) {
      SENATORIAL_DISTRICTS.push({
        id: `${state.code}-${i + 1}`,
        name: `${state.name} ${suffixes[i]}`,
        stateCode: state.code,
      });
    }
  }
}

// Federal constituencies per state (total 360)
// Official INEC allocation — total 360
export const CONSTITUENCY_COUNT: Record<string, number> = {
  SO: 11, KB: 8, ZA: 7, KT: 15, KN: 24, JI: 11, KD: 16,
  BO: 10, YO: 6,  AD: 8,  GO: 6,  BA: 12, TA: 6,
  NI: 10, KW: 6,  FC: 2,  KO: 9,  NA: 5,  PL: 8,  BE: 11,
  LA: 24, OG: 9,  OY: 14, OS: 9,  ON: 9,  EK: 6,
  RV: 13, DL: 10, ED: 9,  BY: 5,  CR: 8,  AK: 10,
  AN: 11, IM: 10, EN: 8,  AB: 8,  EB: 6,
};

export const TOTAL_REGISTERED_VOTERS = STATES.reduce(
  (sum, s) => sum + (s.registeredVoters ?? 0),
  0
);
