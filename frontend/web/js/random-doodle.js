export function nextDoodle(current,total,random=Math.random){
 if(total<=1)return 1;
 if(current<1||current>total)return 1+Math.floor(random()*total);
 const choice=1+Math.floor(random()*(total-1));return choice>=current?choice+1:choice;
}
