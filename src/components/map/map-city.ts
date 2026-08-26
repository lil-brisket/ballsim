export type MapCityStatus = "available" | "occupied" | "selected";

export type MapCity = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  locationLabel?: string;
  status: MapCityStatus;
  detail?: string;
};
