/**
 * Canonical city metadata for map rendering and city selection.
 * Display names match team-cities-by-area.ts pool strings exactly.
 */
import type { LeagueArea } from "@/domain/game-settings";
import { getTeamCitiesForArea } from "@/data/league/team-cities-by-area";

export type TeamCity = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

const CITY_BY_NAME: Record<string, TeamCity> = {
  "Abidjan": { id: "abidjan", name: "Abidjan", lat: 5.36, lng: -4.01 },
  "Abu Dhabi": { id: "abu_dhabi", name: "Abu Dhabi", lat: 24.45, lng: 54.38 },
  "Abuja": { id: "abuja", name: "Abuja", lat: 9.08, lng: 7.4 },
  "Accra": { id: "accra", name: "Accra", lat: 5.6, lng: -0.19 },
  "Addis Ababa": { id: "addis_ababa", name: "Addis Ababa", lat: 9.03, lng: 38.74 },
  "Alexandria": { id: "alexandria", name: "Alexandria", lat: 31.2, lng: 29.92 },
  "Algiers": { id: "algiers", name: "Algiers", lat: 36.75, lng: 3.06 },
  "Almaty": { id: "almaty", name: "Almaty", lat: 43.22, lng: 76.85 },
  "Amsterdam": { id: "amsterdam", name: "Amsterdam", lat: 52.37, lng: 4.89 },
  "Antananarivo": { id: "antananarivo", name: "Antananarivo", lat: -18.88, lng: 47.51 },
  "Arequipa": { id: "arequipa", name: "Arequipa", lat: -16.41, lng: -71.54 },
  "Asunción": { id: "asuncion", name: "Asunción", lat: -25.26, lng: -57.58 },
  "Athens": { id: "athens", name: "Athens", lat: 37.98, lng: 23.73 },
  "Atlanta": { id: "atlanta", name: "Atlanta", lat: 33.75, lng: -84.39 },
  "Auckland": { id: "auckland", name: "Auckland", lat: -36.85, lng: 174.76 },
  "Austin": { id: "austin", name: "Austin", lat: 30.27, lng: -97.74 },
  "Baku": { id: "baku", name: "Baku", lat: 40.41, lng: 49.87 },
  "Baltimore": { id: "baltimore", name: "Baltimore", lat: 39.29, lng: -76.61 },
  "Bamako": { id: "bamako", name: "Bamako", lat: 12.64, lng: -8 },
  "Bangalore": { id: "bangalore", name: "Bangalore", lat: 12.97, lng: 77.59 },
  "Bangkok": { id: "bangkok", name: "Bangkok", lat: 13.76, lng: 100.5 },
  "Barcelona": { id: "barcelona", name: "Barcelona", lat: 41.39, lng: 2.17 },
  "Barquisimeto": { id: "barquisimeto", name: "Barquisimeto", lat: 10.07, lng: -69.32 },
  "Barranquilla": { id: "barranquilla", name: "Barranquilla", lat: 10.96, lng: -74.8 },
  "Beijing": { id: "beijing", name: "Beijing", lat: 39.9, lng: 116.4 },
  "Belém": { id: "belem", name: "Belém", lat: -1.46, lng: -48.5 },
  "Belgrade": { id: "belgrade", name: "Belgrade", lat: 44.79, lng: 20.45 },
  "Belo Horizonte": { id: "belo_horizonte", name: "Belo Horizonte", lat: -19.92, lng: -43.94 },
  "Berlin": { id: "berlin", name: "Berlin", lat: 52.52, lng: 13.41 },
  "Birmingham": { id: "birmingham", name: "Birmingham", lat: 52.49, lng: -1.89 },
  "Bloemfontein": { id: "bloemfontein", name: "Bloemfontein", lat: -29.12, lng: 26.21 },
  "Bogotá": { id: "bogota", name: "Bogotá", lat: 4.71, lng: -74.07 },
  "Boston": { id: "boston", name: "Boston", lat: 42.36, lng: -71.06 },
  "Brasília": { id: "brasilia", name: "Brasília", lat: -15.79, lng: -47.88 },
  "Brussels": { id: "brussels", name: "Brussels", lat: 50.85, lng: 4.35 },
  "Bucaramanga": { id: "bucaramanga", name: "Bucaramanga", lat: 7.12, lng: -73.12 },
  "Bucharest": { id: "bucharest", name: "Bucharest", lat: 44.43, lng: 26.1 },
  "Budapest": { id: "budapest", name: "Budapest", lat: 47.5, lng: 19.04 },
  "Buenos Aires": { id: "buenos_aires", name: "Buenos Aires", lat: -34.6, lng: -58.38 },
  "Busan": { id: "busan", name: "Busan", lat: 35.18, lng: 129.08 },
  "Cairo": { id: "cairo", name: "Cairo", lat: 30.04, lng: 31.24 },
  "Calgary": { id: "calgary", name: "Calgary", lat: 51.05, lng: -114.07 },
  "Cali": { id: "cali", name: "Cali", lat: 3.45, lng: -76.53 },
  "Campinas": { id: "campinas", name: "Campinas", lat: -22.91, lng: -47.06 },
  "Cape Town": { id: "cape_town", name: "Cape Town", lat: -33.92, lng: 18.42 },
  "Caracas": { id: "caracas", name: "Caracas", lat: 10.48, lng: -66.9 },
  "Cartagena": { id: "cartagena", name: "Cartagena", lat: 10.39, lng: -75.51 },
  "Casablanca": { id: "casablanca", name: "Casablanca", lat: 33.57, lng: -7.59 },
  "Charlotte": { id: "charlotte", name: "Charlotte", lat: 35.23, lng: -80.84 },
  "Chengdu": { id: "chengdu", name: "Chengdu", lat: 30.57, lng: 104.07 },
  "Chennai": { id: "chennai", name: "Chennai", lat: 13.08, lng: 80.27 },
  "Chicago": { id: "chicago", name: "Chicago", lat: 41.88, lng: -87.63 },
  "Cleveland": { id: "cleveland", name: "Cleveland", lat: 41.5, lng: -81.69 },
  "Cochabamba": { id: "cochabamba", name: "Cochabamba", lat: -17.39, lng: -66.16 },
  "Cologne": { id: "cologne", name: "Cologne", lat: 50.94, lng: 6.96 },
  "Columbus": { id: "columbus", name: "Columbus", lat: 39.96, lng: -82.99 },
  "Concepción": { id: "concepcion", name: "Concepción", lat: -36.83, lng: -73.05 },
  "Copenhagen": { id: "copenhagen", name: "Copenhagen", lat: 55.68, lng: 12.57 },
  "Córdoba": { id: "cordoba", name: "Córdoba", lat: -31.42, lng: -64.19 },
  "Curitiba": { id: "curitiba", name: "Curitiba", lat: -25.43, lng: -49.27 },
  "Cusco": { id: "cusco", name: "Cusco", lat: -13.53, lng: -71.97 },
  "Dakar": { id: "dakar", name: "Dakar", lat: 14.72, lng: -17.47 },
  "Dallas": { id: "dallas", name: "Dallas", lat: 32.78, lng: -96.8 },
  "Dar es Salaam": { id: "dar_es_salaam", name: "Dar es Salaam", lat: -6.79, lng: 39.21 },
  "Delhi": { id: "delhi", name: "Delhi", lat: 28.61, lng: 77.21 },
  "Denver": { id: "denver", name: "Denver", lat: 39.74, lng: -104.99 },
  "Detroit": { id: "detroit", name: "Detroit", lat: 42.33, lng: -83.05 },
  "Dhaka": { id: "dhaka", name: "Dhaka", lat: 23.81, lng: 90.41 },
  "Doha": { id: "doha", name: "Doha", lat: 25.29, lng: 51.53 },
  "Douala": { id: "douala", name: "Douala", lat: 4.05, lng: 9.7 },
  "Dubai": { id: "dubai", name: "Dubai", lat: 25.2, lng: 55.27 },
  "Dublin": { id: "dublin", name: "Dublin", lat: 53.35, lng: -6.26 },
  "Durban": { id: "durban", name: "Durban", lat: -29.86, lng: 31.02 },
  "Edinburgh": { id: "edinburgh", name: "Edinburgh", lat: 55.95, lng: -3.19 },
  "Edmonton": { id: "edmonton", name: "Edmonton", lat: 53.55, lng: -113.49 },
  "Enugu": { id: "enugu", name: "Enugu", lat: 6.46, lng: 7.51 },
  "Florianópolis": { id: "florianopolis", name: "Florianópolis", lat: -27.6, lng: -48.55 },
  "Fortaleza": { id: "fortaleza", name: "Fortaleza", lat: -3.73, lng: -38.52 },
  "Frankfurt": { id: "frankfurt", name: "Frankfurt", lat: 50.11, lng: 8.68 },
  "Freetown": { id: "freetown", name: "Freetown", lat: 8.48, lng: -13.23 },
  "Gaborone": { id: "gaborone", name: "Gaborone", lat: -24.63, lng: 25.91 },
  "Glasgow": { id: "glasgow", name: "Glasgow", lat: 55.86, lng: -4.25 },
  "Goiânia": { id: "goiania", name: "Goiânia", lat: -16.69, lng: -49.25 },
  "Gothenburg": { id: "gothenburg", name: "Gothenburg", lat: 57.71, lng: 11.97 },
  "Guadalajara": { id: "guadalajara", name: "Guadalajara", lat: 20.67, lng: -103.35 },
  "Guangzhou": { id: "guangzhou", name: "Guangzhou", lat: 23.13, lng: 113.26 },
  "Guayaquil": { id: "guayaquil", name: "Guayaquil", lat: -2.17, lng: -79.92 },
  "Hamburg": { id: "hamburg", name: "Hamburg", lat: 53.55, lng: 9.99 },
  "Hanoi": { id: "hanoi", name: "Hanoi", lat: 21.03, lng: 105.85 },
  "Harare": { id: "harare", name: "Harare", lat: -17.83, lng: 31.05 },
  "Helsinki": { id: "helsinki", name: "Helsinki", lat: 60.17, lng: 24.94 },
  "Ho Chi Minh City": { id: "ho_chi_minh_city", name: "Ho Chi Minh City", lat: 10.82, lng: 106.63 },
  "Hong Kong": { id: "hong_kong", name: "Hong Kong", lat: 22.32, lng: 114.17 },
  "Houston": { id: "houston", name: "Houston", lat: 29.76, lng: -95.37 },
  "Hyderabad": { id: "hyderabad", name: "Hyderabad", lat: 17.39, lng: 78.49 },
  "Ibadan": { id: "ibadan", name: "Ibadan", lat: 7.38, lng: 3.9 },
  "Indianapolis": { id: "indianapolis", name: "Indianapolis", lat: 39.77, lng: -86.16 },
  "Islamabad": { id: "islamabad", name: "Islamabad", lat: 33.68, lng: 73.05 },
  "Istanbul": { id: "istanbul", name: "Istanbul", lat: 41.01, lng: 28.98 },
  "Jakarta": { id: "jakarta", name: "Jakarta", lat: -6.21, lng: 106.85 },
  "Johannesburg": { id: "johannesburg", name: "Johannesburg", lat: -26.2, lng: 28.04 },
  "Kampala": { id: "kampala", name: "Kampala", lat: 0.35, lng: 32.58 },
  "Kansas City": { id: "kansas_city", name: "Kansas City", lat: 39.1, lng: -94.58 },
  "Karachi": { id: "karachi", name: "Karachi", lat: 24.86, lng: 67 },
  "Khartoum": { id: "khartoum", name: "Khartoum", lat: 15.5, lng: 32.56 },
  "Kigali": { id: "kigali", name: "Kigali", lat: -1.94, lng: 30.06 },
  "Kinshasa": { id: "kinshasa", name: "Kinshasa", lat: -4.44, lng: 15.27 },
  "Kolkata": { id: "kolkata", name: "Kolkata", lat: 22.57, lng: 88.36 },
  "Krakow": { id: "krakow", name: "Krakow", lat: 50.06, lng: 19.94 },
  "Kuala Lumpur": { id: "kuala_lumpur", name: "Kuala Lumpur", lat: 3.14, lng: 101.69 },
  "Kumasi": { id: "kumasi", name: "Kumasi", lat: 6.69, lng: -1.62 },
  "Kuwait City": { id: "kuwait_city", name: "Kuwait City", lat: 29.38, lng: 47.98 },
  "Kyoto": { id: "kyoto", name: "Kyoto", lat: 35.01, lng: 135.77 },
  "La Paz": { id: "la_paz", name: "La Paz", lat: -16.49, lng: -68.13 },
  "La Plata": { id: "la_plata", name: "La Plata", lat: -34.92, lng: -57.95 },
  "Lagos": { id: "lagos", name: "Lagos", lat: 6.52, lng: 3.38 },
  "Lahore": { id: "lahore", name: "Lahore", lat: 31.52, lng: 74.36 },
  "Las Vegas": { id: "las_vegas", name: "Las Vegas", lat: 36.17, lng: -115.14 },
  "Lima": { id: "lima", name: "Lima", lat: -12.05, lng: -77.04 },
  "Lisbon": { id: "lisbon", name: "Lisbon", lat: 38.72, lng: -9.14 },
  "London": { id: "london", name: "London", lat: 51.51, lng: -0.13 },
  "Los Angeles": { id: "los_angeles", name: "Los Angeles", lat: 34.05, lng: -118.24 },
  "Luanda": { id: "luanda", name: "Luanda", lat: -8.84, lng: 13.23 },
  "Lusaka": { id: "lusaka", name: "Lusaka", lat: -15.39, lng: 28.32 },
  "Lyon": { id: "lyon", name: "Lyon", lat: 45.76, lng: 4.84 },
  "Madrid": { id: "madrid", name: "Madrid", lat: 40.42, lng: -3.7 },
  "Manaus": { id: "manaus", name: "Manaus", lat: -3.12, lng: -60.02 },
  "Manchester": { id: "manchester", name: "Manchester", lat: 53.48, lng: -2.24 },
  "Manila": { id: "manila", name: "Manila", lat: 14.6, lng: 120.98 },
  "Maputo": { id: "maputo", name: "Maputo", lat: -25.97, lng: 32.57 },
  "Mar del Plata": { id: "mar_del_plata", name: "Mar del Plata", lat: -38, lng: -57.55 },
  "Maracaibo": { id: "maracaibo", name: "Maracaibo", lat: 10.65, lng: -71.61 },
  "Marrakesh": { id: "marrakesh", name: "Marrakesh", lat: 31.63, lng: -8.01 },
  "Marseille": { id: "marseille", name: "Marseille", lat: 43.3, lng: 5.37 },
  "Medellín": { id: "medellin", name: "Medellín", lat: 6.25, lng: -75.56 },
  "Melbourne": { id: "melbourne", name: "Melbourne", lat: -37.81, lng: 144.96 },
  "Memphis": { id: "memphis", name: "Memphis", lat: 35.15, lng: -90.05 },
  "Mendoza": { id: "mendoza", name: "Mendoza", lat: -32.89, lng: -68.85 },
  "Mexico City": { id: "mexico_city", name: "Mexico City", lat: 19.43, lng: -99.13 },
  "Miami": { id: "miami", name: "Miami", lat: 25.76, lng: -80.19 },
  "Milan": { id: "milan", name: "Milan", lat: 45.46, lng: 9.19 },
  "Milwaukee": { id: "milwaukee", name: "Milwaukee", lat: 43.04, lng: -87.91 },
  "Minneapolis": { id: "minneapolis", name: "Minneapolis", lat: 44.98, lng: -93.27 },
  "Mombasa": { id: "mombasa", name: "Mombasa", lat: -4.04, lng: 39.67 },
  "Monrovia": { id: "monrovia", name: "Monrovia", lat: 6.3, lng: -10.8 },
  "Monterrey": { id: "monterrey", name: "Monterrey", lat: 25.67, lng: -100.31 },
  "Montevideo": { id: "montevideo", name: "Montevideo", lat: -34.9, lng: -56.19 },
  "Montreal": { id: "montreal", name: "Montreal", lat: 45.5, lng: -73.57 },
  "Mumbai": { id: "mumbai", name: "Mumbai", lat: 19.08, lng: 72.88 },
  "Munich": { id: "munich", name: "Munich", lat: 48.14, lng: 11.58 },
  "Nagoya": { id: "nagoya", name: "Nagoya", lat: 35.18, lng: 136.91 },
  "Nairobi": { id: "nairobi", name: "Nairobi", lat: -1.29, lng: 36.82 },
  "Naples": { id: "naples", name: "Naples", lat: 40.85, lng: 14.27 },
  "Nashville": { id: "nashville", name: "Nashville", lat: 36.16, lng: -86.78 },
  "Natal": { id: "natal", name: "Natal", lat: -5.79, lng: -35.21 },
  "New Orleans": { id: "new_orleans", name: "New Orleans", lat: 29.95, lng: -90.07 },
  "New York": { id: "new_york", name: "New York", lat: 40.71, lng: -74.01 },
  "Nice": { id: "nice", name: "Nice", lat: 43.71, lng: 7.26 },
  "Oklahoma City": { id: "oklahoma_city", name: "Oklahoma City", lat: 35.47, lng: -97.52 },
  "Oran": { id: "oran", name: "Oran", lat: 35.7, lng: -0.63 },
  "Orlando": { id: "orlando", name: "Orlando", lat: 28.54, lng: -81.38 },
  "Osaka": { id: "osaka", name: "Osaka", lat: 34.69, lng: 135.5 },
  "Oslo": { id: "oslo", name: "Oslo", lat: 59.91, lng: 10.75 },
  "Ottawa": { id: "ottawa", name: "Ottawa", lat: 45.42, lng: -75.7 },
  "Ouagadougou": { id: "ouagadougou", name: "Ouagadougou", lat: 12.37, lng: -1.53 },
  "Paris": { id: "paris", name: "Paris", lat: 48.86, lng: 2.35 },
  "Pereira": { id: "pereira", name: "Pereira", lat: 4.81, lng: -75.69 },
  "Philadelphia": { id: "philadelphia", name: "Philadelphia", lat: 39.95, lng: -75.17 },
  "Phnom Penh": { id: "phnom_penh", name: "Phnom Penh", lat: 11.56, lng: 104.93 },
  "Phoenix": { id: "phoenix", name: "Phoenix", lat: 33.45, lng: -112.07 },
  "Pittsburgh": { id: "pittsburgh", name: "Pittsburgh", lat: 40.44, lng: -79.99 },
  "Port Elizabeth": { id: "port_elizabeth", name: "Port Elizabeth", lat: -33.96, lng: 25.6 },
  "Port Louis": { id: "port_louis", name: "Port Louis", lat: -20.16, lng: 57.5 },
  "Portland": { id: "portland", name: "Portland", lat: 45.52, lng: -122.68 },
  "Porto": { id: "porto", name: "Porto", lat: 41.16, lng: -8.63 },
  "Porto Alegre": { id: "porto_alegre", name: "Porto Alegre", lat: -30.03, lng: -51.23 },
  "Prague": { id: "prague", name: "Prague", lat: 50.08, lng: 14.44 },
  "Pretoria": { id: "pretoria", name: "Pretoria", lat: -25.75, lng: 28.19 },
  "Quito": { id: "quito", name: "Quito", lat: -0.18, lng: -78.47 },
  "Rabat": { id: "rabat", name: "Rabat", lat: 34.02, lng: -6.84 },
  "Recife": { id: "recife", name: "Recife", lat: -8.05, lng: -34.88 },
  "Rio de Janeiro": { id: "rio_de_janeiro", name: "Rio de Janeiro", lat: -22.91, lng: -43.17 },
  "Riyadh": { id: "riyadh", name: "Riyadh", lat: 24.71, lng: 46.68 },
  "Rome": { id: "rome", name: "Rome", lat: 41.9, lng: 12.5 },
  "Rosario": { id: "rosario", name: "Rosario", lat: -32.94, lng: -60.64 },
  "Rotterdam": { id: "rotterdam", name: "Rotterdam", lat: 51.92, lng: 4.48 },
  "Sacramento": { id: "sacramento", name: "Sacramento", lat: 38.58, lng: -121.49 },
  "Salt Lake City": { id: "salt_lake_city", name: "Salt Lake City", lat: 40.76, lng: -111.89 },
  "Salvador": { id: "salvador", name: "Salvador", lat: -12.97, lng: -38.5 },
  "San Antonio": { id: "san_antonio", name: "San Antonio", lat: 29.42, lng: -98.49 },
  "San Diego": { id: "san_diego", name: "San Diego", lat: 32.72, lng: -117.16 },
  "San Francisco": { id: "san_francisco", name: "San Francisco", lat: 37.77, lng: -122.42 },
  "Santa Cruz": { id: "santa_cruz", name: "Santa Cruz", lat: -17.78, lng: -63.18 },
  "Santiago": { id: "santiago", name: "Santiago", lat: -33.45, lng: -70.67 },
  "São Paulo": { id: "sao_paulo", name: "São Paulo", lat: -23.55, lng: -46.63 },
  "Seattle": { id: "seattle", name: "Seattle", lat: 47.61, lng: -122.33 },
  "Seoul": { id: "seoul", name: "Seoul", lat: 37.57, lng: 126.98 },
  "Seville": { id: "seville", name: "Seville", lat: 37.39, lng: -5.98 },
  "Shanghai": { id: "shanghai", name: "Shanghai", lat: 31.23, lng: 121.47 },
  "Shenzhen": { id: "shenzhen", name: "Shenzhen", lat: 22.54, lng: 114.06 },
  "Singapore": { id: "singapore", name: "Singapore", lat: 1.35, lng: 103.82 },
  "Sofia": { id: "sofia", name: "Sofia", lat: 42.7, lng: 23.32 },
  "St. Louis": { id: "st_louis", name: "St. Louis", lat: 38.63, lng: -90.2 },
  "Stockholm": { id: "stockholm", name: "Stockholm", lat: 59.33, lng: 18.07 },
  "Sydney": { id: "sydney", name: "Sydney", lat: -33.87, lng: 151.21 },
  "Taipei": { id: "taipei", name: "Taipei", lat: 25.03, lng: 121.57 },
  "Tampa": { id: "tampa", name: "Tampa", lat: 27.95, lng: -82.46 },
  "Tashkent": { id: "tashkent", name: "Tashkent", lat: 41.3, lng: 69.24 },
  "Tbilisi": { id: "tbilisi", name: "Tbilisi", lat: 41.72, lng: 44.79 },
  "Tel Aviv": { id: "tel_aviv", name: "Tel Aviv", lat: 32.09, lng: 34.78 },
  "Tijuana": { id: "tijuana", name: "Tijuana", lat: 32.51, lng: -117.04 },
  "Tokyo": { id: "tokyo", name: "Tokyo", lat: 35.68, lng: 139.69 },
  "Toronto": { id: "toronto", name: "Toronto", lat: 43.65, lng: -79.38 },
  "Tripoli": { id: "tripoli", name: "Tripoli", lat: 32.89, lng: 13.19 },
  "Trujillo": { id: "trujillo", name: "Trujillo", lat: -8.11, lng: -79.03 },
  "Tunis": { id: "tunis", name: "Tunis", lat: 36.81, lng: 10.18 },
  "Turin": { id: "turin", name: "Turin", lat: 45.07, lng: 7.69 },
  "Ulaanbaatar": { id: "ulaanbaatar", name: "Ulaanbaatar", lat: 47.92, lng: 106.92 },
  "Valencia": { id: "valencia", name: "Valencia", lat: 39.47, lng: -0.38 },
  "Valparaíso": { id: "valparaiso", name: "Valparaíso", lat: -33.05, lng: -71.62 },
  "Vancouver": { id: "vancouver", name: "Vancouver", lat: 49.28, lng: -123.12 },
  "Vienna": { id: "vienna", name: "Vienna", lat: 48.21, lng: 16.37 },
  "Vientiane": { id: "vientiane", name: "Vientiane", lat: 17.98, lng: 102.63 },
  "Warsaw": { id: "warsaw", name: "Warsaw", lat: 52.23, lng: 21.01 },
  "Washington": { id: "washington", name: "Washington", lat: 38.91, lng: -77.04 },
  "Windhoek": { id: "windhoek", name: "Windhoek", lat: -22.56, lng: 17.07 },
  "Winnipeg": { id: "winnipeg", name: "Winnipeg", lat: 49.9, lng: -97.14 },
  "Yangon": { id: "yangon", name: "Yangon", lat: 16.87, lng: 96.2 },
  "Yaounde": { id: "yaounde", name: "Yaounde", lat: 3.85, lng: 11.5 },
  "Yerevan": { id: "yerevan", name: "Yerevan", lat: 40.18, lng: 44.51 },
  "Zagreb": { id: "zagreb", name: "Zagreb", lat: 45.81, lng: 15.98 },
  "Zurich": { id: "zurich", name: "Zurich", lat: 47.38, lng: 8.54 },
};

/**
 * Normalize a city string for comparison against canonical pool names.
 * Returns null for empty/invalid input.
 */
export function normalizeCityName(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const folded = trimmed
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  for (const city of Object.keys(CITY_BY_NAME)) {
    const candidate = city
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (candidate === folded) {
      return city;
    }
  }
  return null;
}

export function getCityByName(name: string): TeamCity | null {
  const canonical = normalizeCityName(name);
  if (canonical === null) {
    return null;
  }
  return CITY_BY_NAME[canonical] ?? null;
}

export function getCitiesForArea(area: LeagueArea): readonly TeamCity[] {
  return getTeamCitiesForArea(area).map((name) => {
    const city = CITY_BY_NAME[name];
    if (!city) {
      throw new Error(`Missing city location for "${name}" in area "${area}".`);
    }
    return city;
  });
}

export function isCityInArea(city: string, area: LeagueArea): boolean {
  const canonical = normalizeCityName(city);
  if (canonical === null) {
    return false;
  }
  return (getTeamCitiesForArea(area) as readonly string[]).includes(canonical);
}

export function allKnownCities(): readonly TeamCity[] {
  return Object.values(CITY_BY_NAME);
}
