module.exports = function forecast() {
  const time = Array.from({length:7}, (_,i)=>new Date(Date.UTC(2026,9,28+i)).toISOString().slice(0,10));
  const daily={time,weather_code:Array(7).fill(1),temperature_2m_max:Array(7).fill(23),temperature_2m_min:Array(7).fill(14),precipitation_sum:Array(7).fill(0),precipitation_probability_max:Array(7).fill(10),wind_speed_10m_max:Array(7).fill(8),uv_index_max:Array(7).fill(4)};
  const hourly={time:[],temperature_2m:[],weather_code:[],precipitation_probability:[],relative_humidity_2m:[]};
  time.forEach((date,day)=>{for(let h=0;h<24;h++){hourly.time.push(`${date}T${String(h).padStart(2,'0')}:00`); hourly.temperature_2m.push((h<10?16:22)+(day===0?2:0));hourly.weather_code.push(1);hourly.precipitation_probability.push(10);hourly.relative_humidity_2m.push(40)}});
  return {daily,hourly};
}
