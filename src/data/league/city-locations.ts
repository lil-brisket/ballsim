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
  country: string;
  subdivision?: string;
};

const CITY_BY_NAME: Record<string, TeamCity> = {
  "Abidjan": { id: "abidjan", name: "Abidjan", lat: 5.36, lng: -4.01, country: "Côte d'Ivoire" },
  "Abu Dhabi": { id: "abu_dhabi", name: "Abu Dhabi", lat: 24.45, lng: 54.38, country: "United Arab Emirates" },
  "Abuja": { id: "abuja", name: "Abuja", lat: 9.08, lng: 7.4, country: "Nigeria", subdivision: "Federal Capital Territory" },
  "Accra": { id: "accra", name: "Accra", lat: 5.6, lng: -0.19, country: "Ghana" },
  "Addis Ababa": { id: "addis_ababa", name: "Addis Ababa", lat: 9.03, lng: 38.74, country: "Ethiopia" },
  "Alexandria": { id: "alexandria", name: "Alexandria", lat: 31.2, lng: 29.92, country: "Egypt" },
  "Algiers": { id: "algiers", name: "Algiers", lat: 36.75, lng: 3.06, country: "Algeria" },
  "Almaty": { id: "almaty", name: "Almaty", lat: 43.22, lng: 76.85, country: "Kazakhstan" },
  "Amsterdam": { id: "amsterdam", name: "Amsterdam", lat: 52.37, lng: 4.89, country: "Netherlands" },
  "Antananarivo": { id: "antananarivo", name: "Antananarivo", lat: -18.88, lng: 47.51, country: "Madagascar" },
  "Arequipa": { id: "arequipa", name: "Arequipa", lat: -16.41, lng: -71.54, country: "Peru", subdivision: "Arequipa" },
  "Asunción": { id: "asuncion", name: "Asunción", lat: -25.26, lng: -57.58, country: "Paraguay" },
  "Athens": { id: "athens", name: "Athens", lat: 37.98, lng: 23.73, country: "Greece" },
  "Atlanta": { id: "atlanta", name: "Atlanta", lat: 33.75, lng: -84.39, country: "United States", subdivision: "Georgia" },
  "Auckland": { id: "auckland", name: "Auckland", lat: -36.85, lng: 174.76, country: "New Zealand" },
  "Austin": { id: "austin", name: "Austin", lat: 30.27, lng: -97.74, country: "United States", subdivision: "Texas" },
  "Baku": { id: "baku", name: "Baku", lat: 40.41, lng: 49.87, country: "Azerbaijan" },
  "Baltimore": { id: "baltimore", name: "Baltimore", lat: 39.29, lng: -76.61, country: "United States", subdivision: "Maryland" },
  "Bamako": { id: "bamako", name: "Bamako", lat: 12.64, lng: -8, country: "Mali" },
  "Bangalore": { id: "bangalore", name: "Bangalore", lat: 12.97, lng: 77.59, country: "India", subdivision: "Karnataka" },
  "Bangkok": { id: "bangkok", name: "Bangkok", lat: 13.76, lng: 100.5, country: "Thailand" },
  "Barcelona": { id: "barcelona", name: "Barcelona", lat: 41.39, lng: 2.17, country: "Spain", subdivision: "Catalonia" },
  "Barquisimeto": { id: "barquisimeto", name: "Barquisimeto", lat: 10.07, lng: -69.32, country: "Venezuela" },
  "Barranquilla": { id: "barranquilla", name: "Barranquilla", lat: 10.96, lng: -74.8, country: "Colombia", subdivision: "Atlántico" },
  "Beijing": { id: "beijing", name: "Beijing", lat: 39.9, lng: 116.4, country: "China" },
  "Belém": { id: "belem", name: "Belém", lat: -1.46, lng: -48.5, country: "Brazil", subdivision: "Pará" },
  "Belgrade": { id: "belgrade", name: "Belgrade", lat: 44.79, lng: 20.45, country: "Serbia" },
  "Belo Horizonte": { id: "belo_horizonte", name: "Belo Horizonte", lat: -19.92, lng: -43.94, country: "Brazil", subdivision: "Minas Gerais" },
  "Berlin": { id: "berlin", name: "Berlin", lat: 52.52, lng: 13.41, country: "Germany" },
  "Birmingham": { id: "birmingham", name: "Birmingham", lat: 52.49, lng: -1.89, country: "United Kingdom", subdivision: "England" },
  "Bloemfontein": { id: "bloemfontein", name: "Bloemfontein", lat: -29.12, lng: 26.21, country: "South Africa", subdivision: "Free State" },
  "Bogotá": { id: "bogota", name: "Bogotá", lat: 4.71, lng: -74.07, country: "Colombia" },
  "Boston": { id: "boston", name: "Boston", lat: 42.36, lng: -71.06, country: "United States", subdivision: "Massachusetts" },
  "Brasília": { id: "brasilia", name: "Brasília", lat: -15.79, lng: -47.88, country: "Brazil", subdivision: "Federal District" },
  "Brussels": { id: "brussels", name: "Brussels", lat: 50.85, lng: 4.35, country: "Belgium" },
  "Bucaramanga": { id: "bucaramanga", name: "Bucaramanga", lat: 7.12, lng: -73.12, country: "Colombia", subdivision: "Santander" },
  "Bucharest": { id: "bucharest", name: "Bucharest", lat: 44.43, lng: 26.1, country: "Romania" },
  "Budapest": { id: "budapest", name: "Budapest", lat: 47.5, lng: 19.04, country: "Hungary" },
  "Buenos Aires": { id: "buenos_aires", name: "Buenos Aires", lat: -34.6, lng: -58.38, country: "Argentina" },
  "Busan": { id: "busan", name: "Busan", lat: 35.18, lng: 129.08, country: "South Korea" },
  "Cairo": { id: "cairo", name: "Cairo", lat: 30.04, lng: 31.24, country: "Egypt" },
  "Calgary": { id: "calgary", name: "Calgary", lat: 51.05, lng: -114.07, country: "Canada", subdivision: "Alberta" },
  "Cali": { id: "cali", name: "Cali", lat: 3.45, lng: -76.53, country: "Colombia", subdivision: "Valle del Cauca" },
  "Campinas": { id: "campinas", name: "Campinas", lat: -22.91, lng: -47.06, country: "Brazil", subdivision: "São Paulo" },
  "Cape Town": { id: "cape_town", name: "Cape Town", lat: -33.92, lng: 18.42, country: "South Africa", subdivision: "Western Cape" },
  "Caracas": { id: "caracas", name: "Caracas", lat: 10.48, lng: -66.9, country: "Venezuela" },
  "Cartagena": { id: "cartagena", name: "Cartagena", lat: 10.39, lng: -75.51, country: "Colombia", subdivision: "Bolívar" },
  "Casablanca": { id: "casablanca", name: "Casablanca", lat: 33.57, lng: -7.59, country: "Morocco" },
  "Charlotte": { id: "charlotte", name: "Charlotte", lat: 35.23, lng: -80.84, country: "United States", subdivision: "North Carolina" },
  "Chengdu": { id: "chengdu", name: "Chengdu", lat: 30.57, lng: 104.07, country: "China", subdivision: "Sichuan" },
  "Chennai": { id: "chennai", name: "Chennai", lat: 13.08, lng: 80.27, country: "India", subdivision: "Tamil Nadu" },
  "Chicago": { id: "chicago", name: "Chicago", lat: 41.88, lng: -87.63, country: "United States", subdivision: "Illinois" },
  "Cleveland": { id: "cleveland", name: "Cleveland", lat: 41.5, lng: -81.69, country: "United States", subdivision: "Ohio" },
  "Cochabamba": { id: "cochabamba", name: "Cochabamba", lat: -17.39, lng: -66.16, country: "Bolivia" },
  "Cologne": { id: "cologne", name: "Cologne", lat: 50.94, lng: 6.96, country: "Germany", subdivision: "North Rhine-Westphalia" },
  "Columbus": { id: "columbus", name: "Columbus", lat: 39.96, lng: -82.99, country: "United States", subdivision: "Ohio" },
  "Concepción": { id: "concepcion", name: "Concepción", lat: -36.83, lng: -73.05, country: "Chile" },
  "Copenhagen": { id: "copenhagen", name: "Copenhagen", lat: 55.68, lng: 12.57, country: "Denmark" },
  "Córdoba": { id: "cordoba", name: "Córdoba", lat: -31.42, lng: -64.19, country: "Argentina" },
  "Curitiba": { id: "curitiba", name: "Curitiba", lat: -25.43, lng: -49.27, country: "Brazil", subdivision: "Paraná" },
  "Cusco": { id: "cusco", name: "Cusco", lat: -13.53, lng: -71.97, country: "Peru", subdivision: "Cusco" },
  "Dakar": { id: "dakar", name: "Dakar", lat: 14.72, lng: -17.47, country: "Senegal" },
  "Dallas": { id: "dallas", name: "Dallas", lat: 32.78, lng: -96.8, country: "United States", subdivision: "Texas" },
  "Dar es Salaam": { id: "dar_es_salaam", name: "Dar es Salaam", lat: -6.79, lng: 39.21, country: "Tanzania" },
  "Delhi": { id: "delhi", name: "Delhi", lat: 28.61, lng: 77.21, country: "India" },
  "Denver": { id: "denver", name: "Denver", lat: 39.74, lng: -104.99, country: "United States", subdivision: "Colorado" },
  "Detroit": { id: "detroit", name: "Detroit", lat: 42.33, lng: -83.05, country: "United States", subdivision: "Michigan" },
  "Dhaka": { id: "dhaka", name: "Dhaka", lat: 23.81, lng: 90.41, country: "Bangladesh" },
  "Doha": { id: "doha", name: "Doha", lat: 25.29, lng: 51.53, country: "Qatar" },
  "Douala": { id: "douala", name: "Douala", lat: 4.05, lng: 9.7, country: "Cameroon" },
  "Dubai": { id: "dubai", name: "Dubai", lat: 25.2, lng: 55.27, country: "United Arab Emirates" },
  "Dublin": { id: "dublin", name: "Dublin", lat: 53.35, lng: -6.26, country: "Ireland" },
  "Durban": { id: "durban", name: "Durban", lat: -29.86, lng: 31.02, country: "South Africa", subdivision: "KwaZulu-Natal" },
  "Edinburgh": { id: "edinburgh", name: "Edinburgh", lat: 55.95, lng: -3.19, country: "United Kingdom", subdivision: "Scotland" },
  "Edmonton": { id: "edmonton", name: "Edmonton", lat: 53.55, lng: -113.49, country: "Canada", subdivision: "Alberta" },
  "Enugu": { id: "enugu", name: "Enugu", lat: 6.46, lng: 7.51, country: "Nigeria", subdivision: "Enugu" },
  "Florianópolis": { id: "florianopolis", name: "Florianópolis", lat: -27.6, lng: -48.55, country: "Brazil", subdivision: "Santa Catarina" },
  "Fortaleza": { id: "fortaleza", name: "Fortaleza", lat: -3.73, lng: -38.52, country: "Brazil", subdivision: "Ceará" },
  "Frankfurt": { id: "frankfurt", name: "Frankfurt", lat: 50.11, lng: 8.68, country: "Germany", subdivision: "Hesse" },
  "Freetown": { id: "freetown", name: "Freetown", lat: 8.48, lng: -13.23, country: "Sierra Leone" },
  "Gaborone": { id: "gaborone", name: "Gaborone", lat: -24.63, lng: 25.91, country: "Botswana" },
  "Glasgow": { id: "glasgow", name: "Glasgow", lat: 55.86, lng: -4.25, country: "United Kingdom", subdivision: "Scotland" },
  "Goiânia": { id: "goiania", name: "Goiânia", lat: -16.69, lng: -49.25, country: "Brazil", subdivision: "Goiás" },
  "Gothenburg": { id: "gothenburg", name: "Gothenburg", lat: 57.71, lng: 11.97, country: "Sweden" },
  "Guadalajara": { id: "guadalajara", name: "Guadalajara", lat: 20.67, lng: -103.35, country: "Mexico", subdivision: "Jalisco" },
  "Guangzhou": { id: "guangzhou", name: "Guangzhou", lat: 23.13, lng: 113.26, country: "China", subdivision: "Guangdong" },
  "Guayaquil": { id: "guayaquil", name: "Guayaquil", lat: -2.17, lng: -79.92, country: "Ecuador" },
  "Hamburg": { id: "hamburg", name: "Hamburg", lat: 53.55, lng: 9.99, country: "Germany" },
  "Hanoi": { id: "hanoi", name: "Hanoi", lat: 21.03, lng: 105.85, country: "Vietnam" },
  "Harare": { id: "harare", name: "Harare", lat: -17.83, lng: 31.05, country: "Zimbabwe" },
  "Helsinki": { id: "helsinki", name: "Helsinki", lat: 60.17, lng: 24.94, country: "Finland" },
  "Ho Chi Minh City": { id: "ho_chi_minh_city", name: "Ho Chi Minh City", lat: 10.82, lng: 106.63, country: "Vietnam" },
  "Hong Kong": { id: "hong_kong", name: "Hong Kong", lat: 22.32, lng: 114.17, country: "China" },
  "Houston": { id: "houston", name: "Houston", lat: 29.76, lng: -95.37, country: "United States", subdivision: "Texas" },
  "Hyderabad": { id: "hyderabad", name: "Hyderabad", lat: 17.39, lng: 78.49, country: "India", subdivision: "Telangana" },
  "Ibadan": { id: "ibadan", name: "Ibadan", lat: 7.38, lng: 3.9, country: "Nigeria", subdivision: "Oyo" },
  "Indianapolis": { id: "indianapolis", name: "Indianapolis", lat: 39.77, lng: -86.16, country: "United States", subdivision: "Indiana" },
  "Islamabad": { id: "islamabad", name: "Islamabad", lat: 33.68, lng: 73.05, country: "Pakistan" },
  "Istanbul": { id: "istanbul", name: "Istanbul", lat: 41.01, lng: 28.98, country: "Turkey" },
  "Jakarta": { id: "jakarta", name: "Jakarta", lat: -6.21, lng: 106.85, country: "Indonesia" },
  "Johannesburg": { id: "johannesburg", name: "Johannesburg", lat: -26.2, lng: 28.04, country: "South Africa", subdivision: "Gauteng" },
  "Kampala": { id: "kampala", name: "Kampala", lat: 0.35, lng: 32.58, country: "Uganda" },
  "Kansas City": { id: "kansas_city", name: "Kansas City", lat: 39.1, lng: -94.58, country: "United States", subdivision: "Missouri" },
  "Karachi": { id: "karachi", name: "Karachi", lat: 24.86, lng: 67, country: "Pakistan" },
  "Khartoum": { id: "khartoum", name: "Khartoum", lat: 15.5, lng: 32.56, country: "Sudan" },
  "Kigali": { id: "kigali", name: "Kigali", lat: -1.94, lng: 30.06, country: "Rwanda" },
  "Kinshasa": { id: "kinshasa", name: "Kinshasa", lat: -4.44, lng: 15.27, country: "Democratic Republic of the Congo" },
  "Kolkata": { id: "kolkata", name: "Kolkata", lat: 22.57, lng: 88.36, country: "India", subdivision: "West Bengal" },
  "Krakow": { id: "krakow", name: "Krakow", lat: 50.06, lng: 19.94, country: "Poland" },
  "Kuala Lumpur": { id: "kuala_lumpur", name: "Kuala Lumpur", lat: 3.14, lng: 101.69, country: "Malaysia" },
  "Kumasi": { id: "kumasi", name: "Kumasi", lat: 6.69, lng: -1.62, country: "Ghana" },
  "Kuwait City": { id: "kuwait_city", name: "Kuwait City", lat: 29.38, lng: 47.98, country: "Kuwait" },
  "Kyoto": { id: "kyoto", name: "Kyoto", lat: 35.01, lng: 135.77, country: "Japan" },
  "La Paz": { id: "la_paz", name: "La Paz", lat: -16.49, lng: -68.13, country: "Bolivia" },
  "La Plata": { id: "la_plata", name: "La Plata", lat: -34.92, lng: -57.95, country: "Argentina", subdivision: "Buenos Aires" },
  "Lagos": { id: "lagos", name: "Lagos", lat: 6.52, lng: 3.38, country: "Nigeria" },
  "Lahore": { id: "lahore", name: "Lahore", lat: 31.52, lng: 74.36, country: "Pakistan" },
  "Las Vegas": { id: "las_vegas", name: "Las Vegas", lat: 36.17, lng: -115.14, country: "United States", subdivision: "Nevada" },
  "Lima": { id: "lima", name: "Lima", lat: -12.05, lng: -77.04, country: "Peru" },
  "Lisbon": { id: "lisbon", name: "Lisbon", lat: 38.72, lng: -9.14, country: "Portugal" },
  "London": { id: "london", name: "London", lat: 51.51, lng: -0.13, country: "United Kingdom", subdivision: "England" },
  "Los Angeles": { id: "los_angeles", name: "Los Angeles", lat: 34.05, lng: -118.24, country: "United States", subdivision: "California" },
  "Luanda": { id: "luanda", name: "Luanda", lat: -8.84, lng: 13.23, country: "Angola" },
  "Lusaka": { id: "lusaka", name: "Lusaka", lat: -15.39, lng: 28.32, country: "Zambia" },
  "Lyon": { id: "lyon", name: "Lyon", lat: 45.76, lng: 4.84, country: "France" },
  "Madrid": { id: "madrid", name: "Madrid", lat: 40.42, lng: -3.7, country: "Spain" },
  "Manaus": { id: "manaus", name: "Manaus", lat: -3.12, lng: -60.02, country: "Brazil", subdivision: "Amazonas" },
  "Manchester": { id: "manchester", name: "Manchester", lat: 53.48, lng: -2.24, country: "United Kingdom", subdivision: "England" },
  "Manila": { id: "manila", name: "Manila", lat: 14.6, lng: 120.98, country: "Philippines" },
  "Maputo": { id: "maputo", name: "Maputo", lat: -25.97, lng: 32.57, country: "Mozambique" },
  "Mar del Plata": { id: "mar_del_plata", name: "Mar del Plata", lat: -38, lng: -57.55, country: "Argentina", subdivision: "Buenos Aires" },
  "Maracaibo": { id: "maracaibo", name: "Maracaibo", lat: 10.65, lng: -71.61, country: "Venezuela" },
  "Marrakesh": { id: "marrakesh", name: "Marrakesh", lat: 31.63, lng: -8.01, country: "Morocco" },
  "Marseille": { id: "marseille", name: "Marseille", lat: 43.3, lng: 5.37, country: "France" },
  "Medellín": { id: "medellin", name: "Medellín", lat: 6.25, lng: -75.56, country: "Colombia", subdivision: "Antioquia" },
  "Melbourne": { id: "melbourne", name: "Melbourne", lat: -37.81, lng: 144.96, country: "Australia", subdivision: "Victoria" },
  "Memphis": { id: "memphis", name: "Memphis", lat: 35.15, lng: -90.05, country: "United States", subdivision: "Tennessee" },
  "Mendoza": { id: "mendoza", name: "Mendoza", lat: -32.89, lng: -68.85, country: "Argentina", subdivision: "Mendoza" },
  "Mexico City": { id: "mexico_city", name: "Mexico City", lat: 19.43, lng: -99.13, country: "Mexico" },
  "Miami": { id: "miami", name: "Miami", lat: 25.76, lng: -80.19, country: "United States", subdivision: "Florida" },
  "Milan": { id: "milan", name: "Milan", lat: 45.46, lng: 9.19, country: "Italy" },
  "Milwaukee": { id: "milwaukee", name: "Milwaukee", lat: 43.04, lng: -87.91, country: "United States", subdivision: "Wisconsin" },
  "Minneapolis": { id: "minneapolis", name: "Minneapolis", lat: 44.98, lng: -93.27, country: "United States", subdivision: "Minnesota" },
  "Mombasa": { id: "mombasa", name: "Mombasa", lat: -4.04, lng: 39.67, country: "Kenya" },
  "Monrovia": { id: "monrovia", name: "Monrovia", lat: 6.3, lng: -10.8, country: "Liberia" },
  "Monterrey": { id: "monterrey", name: "Monterrey", lat: 25.67, lng: -100.31, country: "Mexico", subdivision: "Nuevo León" },
  "Montevideo": { id: "montevideo", name: "Montevideo", lat: -34.9, lng: -56.19, country: "Uruguay" },
  "Montreal": { id: "montreal", name: "Montreal", lat: 45.5, lng: -73.57, country: "Canada", subdivision: "Quebec" },
  "Mumbai": { id: "mumbai", name: "Mumbai", lat: 19.08, lng: 72.88, country: "India", subdivision: "Maharashtra" },
  "Munich": { id: "munich", name: "Munich", lat: 48.14, lng: 11.58, country: "Germany", subdivision: "Bavaria" },
  "Nagoya": { id: "nagoya", name: "Nagoya", lat: 35.18, lng: 136.91, country: "Japan" },
  "Nairobi": { id: "nairobi", name: "Nairobi", lat: -1.29, lng: 36.82, country: "Kenya" },
  "Naples": { id: "naples", name: "Naples", lat: 40.85, lng: 14.27, country: "Italy" },
  "Nashville": { id: "nashville", name: "Nashville", lat: 36.16, lng: -86.78, country: "United States", subdivision: "Tennessee" },
  "Natal": { id: "natal", name: "Natal", lat: -5.79, lng: -35.21, country: "Brazil", subdivision: "Rio Grande do Norte" },
  "New Orleans": { id: "new_orleans", name: "New Orleans", lat: 29.95, lng: -90.07, country: "United States", subdivision: "Louisiana" },
  "New York": { id: "new_york", name: "New York", lat: 40.71, lng: -74.01, country: "United States", subdivision: "New York" },
  "Nice": { id: "nice", name: "Nice", lat: 43.71, lng: 7.26, country: "France" },
  "Oklahoma City": { id: "oklahoma_city", name: "Oklahoma City", lat: 35.47, lng: -97.52, country: "United States", subdivision: "Oklahoma" },
  "Oran": { id: "oran", name: "Oran", lat: 35.7, lng: -0.63, country: "Algeria" },
  "Orlando": { id: "orlando", name: "Orlando", lat: 28.54, lng: -81.38, country: "United States", subdivision: "Florida" },
  "Osaka": { id: "osaka", name: "Osaka", lat: 34.69, lng: 135.5, country: "Japan" },
  "Oslo": { id: "oslo", name: "Oslo", lat: 59.91, lng: 10.75, country: "Norway" },
  "Ottawa": { id: "ottawa", name: "Ottawa", lat: 45.42, lng: -75.7, country: "Canada", subdivision: "Ontario" },
  "Ouagadougou": { id: "ouagadougou", name: "Ouagadougou", lat: 12.37, lng: -1.53, country: "Burkina Faso" },
  "Paris": { id: "paris", name: "Paris", lat: 48.86, lng: 2.35, country: "France" },
  "Pereira": { id: "pereira", name: "Pereira", lat: 4.81, lng: -75.69, country: "Colombia", subdivision: "Risaralda" },
  "Philadelphia": { id: "philadelphia", name: "Philadelphia", lat: 39.95, lng: -75.17, country: "United States", subdivision: "Pennsylvania" },
  "Phnom Penh": { id: "phnom_penh", name: "Phnom Penh", lat: 11.56, lng: 104.93, country: "Cambodia" },
  "Phoenix": { id: "phoenix", name: "Phoenix", lat: 33.45, lng: -112.07, country: "United States", subdivision: "Arizona" },
  "Pittsburgh": { id: "pittsburgh", name: "Pittsburgh", lat: 40.44, lng: -79.99, country: "United States", subdivision: "Pennsylvania" },
  "Port Elizabeth": { id: "port_elizabeth", name: "Port Elizabeth", lat: -33.96, lng: 25.6, country: "South Africa", subdivision: "Eastern Cape" },
  "Port Louis": { id: "port_louis", name: "Port Louis", lat: -20.16, lng: 57.5, country: "Mauritius" },
  "Portland": { id: "portland", name: "Portland", lat: 45.52, lng: -122.68, country: "United States", subdivision: "Oregon" },
  "Porto": { id: "porto", name: "Porto", lat: 41.16, lng: -8.63, country: "Portugal" },
  "Porto Alegre": { id: "porto_alegre", name: "Porto Alegre", lat: -30.03, lng: -51.23, country: "Brazil", subdivision: "Rio Grande do Sul" },
  "Prague": { id: "prague", name: "Prague", lat: 50.08, lng: 14.44, country: "Czechia" },
  "Pretoria": { id: "pretoria", name: "Pretoria", lat: -25.75, lng: 28.19, country: "South Africa", subdivision: "Gauteng" },
  "Quito": { id: "quito", name: "Quito", lat: -0.18, lng: -78.47, country: "Ecuador" },
  "Rabat": { id: "rabat", name: "Rabat", lat: 34.02, lng: -6.84, country: "Morocco" },
  "Recife": { id: "recife", name: "Recife", lat: -8.05, lng: -34.88, country: "Brazil", subdivision: "Pernambuco" },
  "Rio de Janeiro": { id: "rio_de_janeiro", name: "Rio de Janeiro", lat: -22.91, lng: -43.17, country: "Brazil", subdivision: "Rio de Janeiro" },
  "Riyadh": { id: "riyadh", name: "Riyadh", lat: 24.71, lng: 46.68, country: "Saudi Arabia" },
  "Rome": { id: "rome", name: "Rome", lat: 41.9, lng: 12.5, country: "Italy" },
  "Rosario": { id: "rosario", name: "Rosario", lat: -32.94, lng: -60.64, country: "Argentina" },
  "Rotterdam": { id: "rotterdam", name: "Rotterdam", lat: 51.92, lng: 4.48, country: "Netherlands" },
  "Sacramento": { id: "sacramento", name: "Sacramento", lat: 38.58, lng: -121.49, country: "United States", subdivision: "California" },
  "Salt Lake City": { id: "salt_lake_city", name: "Salt Lake City", lat: 40.76, lng: -111.89, country: "United States", subdivision: "Utah" },
  "Salvador": { id: "salvador", name: "Salvador", lat: -12.97, lng: -38.5, country: "Brazil", subdivision: "Bahia" },
  "San Antonio": { id: "san_antonio", name: "San Antonio", lat: 29.42, lng: -98.49, country: "United States", subdivision: "Texas" },
  "San Diego": { id: "san_diego", name: "San Diego", lat: 32.72, lng: -117.16, country: "United States", subdivision: "California" },
  "San Francisco": { id: "san_francisco", name: "San Francisco", lat: 37.77, lng: -122.42, country: "United States", subdivision: "California" },
  "Santa Cruz": { id: "santa_cruz", name: "Santa Cruz", lat: -17.78, lng: -63.18, country: "Bolivia" },
  "Santiago": { id: "santiago", name: "Santiago", lat: -33.45, lng: -70.67, country: "Chile" },
  "São Paulo": { id: "sao_paulo", name: "São Paulo", lat: -23.55, lng: -46.63, country: "Brazil", subdivision: "São Paulo" },
  "Seattle": { id: "seattle", name: "Seattle", lat: 47.61, lng: -122.33, country: "United States", subdivision: "Washington" },
  "Seoul": { id: "seoul", name: "Seoul", lat: 37.57, lng: 126.98, country: "South Korea" },
  "Seville": { id: "seville", name: "Seville", lat: 37.39, lng: -5.98, country: "Spain" },
  "Shanghai": { id: "shanghai", name: "Shanghai", lat: 31.23, lng: 121.47, country: "China" },
  "Shenzhen": { id: "shenzhen", name: "Shenzhen", lat: 22.54, lng: 114.06, country: "China", subdivision: "Guangdong" },
  "Singapore": { id: "singapore", name: "Singapore", lat: 1.35, lng: 103.82, country: "Singapore" },
  "Sofia": { id: "sofia", name: "Sofia", lat: 42.7, lng: 23.32, country: "Bulgaria" },
  "St. Louis": { id: "st_louis", name: "St. Louis", lat: 38.63, lng: -90.2, country: "United States", subdivision: "Missouri" },
  "Stockholm": { id: "stockholm", name: "Stockholm", lat: 59.33, lng: 18.07, country: "Sweden" },
  "Sydney": { id: "sydney", name: "Sydney", lat: -33.87, lng: 151.21, country: "Australia", subdivision: "New South Wales" },
  "Taipei": { id: "taipei", name: "Taipei", lat: 25.03, lng: 121.57, country: "Taiwan" },
  "Tampa": { id: "tampa", name: "Tampa", lat: 27.95, lng: -82.46, country: "United States", subdivision: "Florida" },
  "Tashkent": { id: "tashkent", name: "Tashkent", lat: 41.3, lng: 69.24, country: "Uzbekistan" },
  "Tbilisi": { id: "tbilisi", name: "Tbilisi", lat: 41.72, lng: 44.79, country: "Georgia" },
  "Tel Aviv": { id: "tel_aviv", name: "Tel Aviv", lat: 32.09, lng: 34.78, country: "Israel" },
  "Tijuana": { id: "tijuana", name: "Tijuana", lat: 32.51, lng: -117.04, country: "Mexico", subdivision: "Baja California" },
  "Tokyo": { id: "tokyo", name: "Tokyo", lat: 35.68, lng: 139.69, country: "Japan" },
  "Toronto": { id: "toronto", name: "Toronto", lat: 43.65, lng: -79.38, country: "Canada", subdivision: "Ontario" },
  "Tripoli": { id: "tripoli", name: "Tripoli", lat: 32.89, lng: 13.19, country: "Libya" },
  "Trujillo": { id: "trujillo", name: "Trujillo", lat: -8.11, lng: -79.03, country: "Peru", subdivision: "La Libertad" },
  "Tunis": { id: "tunis", name: "Tunis", lat: 36.81, lng: 10.18, country: "Tunisia" },
  "Turin": { id: "turin", name: "Turin", lat: 45.07, lng: 7.69, country: "Italy" },
  "Ulaanbaatar": { id: "ulaanbaatar", name: "Ulaanbaatar", lat: 47.92, lng: 106.92, country: "Mongolia" },
  "Valencia": { id: "valencia", name: "Valencia", lat: 39.47, lng: -0.38, country: "Spain" },
  "Valparaíso": { id: "valparaiso", name: "Valparaíso", lat: -33.05, lng: -71.62, country: "Chile" },
  "Vancouver": { id: "vancouver", name: "Vancouver", lat: 49.28, lng: -123.12, country: "Canada", subdivision: "British Columbia" },
  "Vienna": { id: "vienna", name: "Vienna", lat: 48.21, lng: 16.37, country: "Austria" },
  "Vientiane": { id: "vientiane", name: "Vientiane", lat: 17.98, lng: 102.63, country: "Laos" },
  "Warsaw": { id: "warsaw", name: "Warsaw", lat: 52.23, lng: 21.01, country: "Poland" },
  "Washington": { id: "washington", name: "Washington", lat: 38.91, lng: -77.04, country: "United States", subdivision: "District of Columbia" },
  "Windhoek": { id: "windhoek", name: "Windhoek", lat: -22.56, lng: 17.07, country: "Namibia" },
  "Winnipeg": { id: "winnipeg", name: "Winnipeg", lat: 49.9, lng: -97.14, country: "Canada", subdivision: "Manitoba" },
  "Yangon": { id: "yangon", name: "Yangon", lat: 16.87, lng: 96.2, country: "Myanmar" },
  "Yaounde": { id: "yaounde", name: "Yaounde", lat: 3.85, lng: 11.5, country: "Cameroon" },
  "Yerevan": { id: "yerevan", name: "Yerevan", lat: 40.18, lng: 44.51, country: "Armenia" },
  "Zagreb": { id: "zagreb", name: "Zagreb", lat: 45.81, lng: 15.98, country: "Croatia" },
  "Zurich": { id: "zurich", name: "Zurich", lat: 47.38, lng: 8.54, country: "Switzerland" },
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

export function formatCityLocation(city: Pick<TeamCity, "country" | "subdivision">): string {
  return city.subdivision
    ? `${city.subdivision}, ${city.country}`
    : city.country;
}
