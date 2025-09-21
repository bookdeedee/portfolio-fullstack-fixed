import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main(){
  await prisma.project.deleteMany({});
  await prisma.item.deleteMany({});

  await prisma.project.createMany({
    data: [
      { id:'p1', title:'Personal Blog', description:'A custom blog platform with markdown editor and SSG for SEO.', imageDataUrl:'', dateISO:'2023-05-01', tagsText: JSON.stringify(['Next.js','Markdown','SSG']), linksText: JSON.stringify([{label:'ดูโปรเจกต์', url:'#'},{label:'GitHub', url:'#'}]) },
      { id:'p2', title:'Task Management App', description:'A sleek and intuitive task app with drag-and-drop and realtime sync.', imageDataUrl:'', dateISO:'2023-08-22', tagsText: JSON.stringify(['Vue.js','Firebase','Productivity']), linksText: JSON.stringify([{label:'ดูโปรเจกต์', url:'#'}]) },
      { id:'p3', title:'E-commerce Platform', description:'A full-featured e-commerce website built with React and Node.js, including payment integration and an admin dashboard.', imageDataUrl:'', dateISO:'2023-10-15', tagsText: JSON.stringify(['React','Node.js','E-commerce','Stripe']), linksText: JSON.stringify([{label:'ดูโปรเจกต์', url:'#'},{label:'GitHub', url:'#'}]) }
    ]
  });

  await prisma.item.createMany({
    data: [
      { id:'i1', title:'Canvas Poster 24×36', description:'High-quality print on canvas.', price:120.00, dateISO:'2023-09-01', imageDataUrl:''},
      { id:'i2', title:'Coffee Grinder', description:'Manual burr grinder with adjustable settings.', price:24.99, dateISO:'2023-09-10', imageDataUrl:''},
      { id:'i3', title:'Handmade Leather Wallet', description:'A beautifully crafted leather wallet, perfect for everyday use.', price:49.99, dateISO:'2023-09-12', imageDataUrl:''}
    ]
  });
  console.log('Seed completed');
}
main().finally(()=>prisma.$disconnect());