import Trello from 'trello';
import fetch from 'node-fetch';
import { FormData, File } from "formdata-node";
import { Parser } from './lib/gcode-parser.js';
import Koa from 'koa';
import Router from 'koa-router';
import koaBody from 'koa-body';
import KoaLogger from 'koa-logger';

// based on PrintQ account in Trello
const apiKey=  process.env.TRELLO_API_TOKEN;
const token = process.env.TRELLO_TOKEN; 
const skipPreviews = [];
const trello = new Trello(apiKey, token);
const PORT = parseInt(process.env.PORT) || 8080;
const app = new Koa();
const router = new Router()

console.log("gcode4trello starting\n");

async function ensurePreview(card) {
    const attachments = await trello.getAttachmentsOnCard(card.id);
    const gcodeFile = attachments.filter(a => a.fileName.endsWith('gcode'))[0];
    const hasPreview = attachments.some( a => a.fileName.startsWith('preview'));
    if (gcodeFile && !hasPreview) {
        // console.log(gcodeFile.fileName,'needs preview');

        const content = await downloadGcodeFile(gcodeFile);
        await createPreview(card, content)
    }
}

async function createPreview(card, content) {
    const parser = new Parser();

    parser.parseGCode(content);
    
    const thumbData = parser.metadata.thumbnails['220x124']?.chars;
    
    if (!thumbData) {
        console.log('no thumbnail found in gcode. add to skip list');
        // todo: add this data to the trello card as a label
        skipPreviews.push(card.id);
        return;
    };
    
    const buff = new Buffer.from(thumbData, 'base64');
    await uploadAttachment(card, buff.buffer, 'preview.png', true);
}

async function uploadAttachment(card, content, filename, cover) {
    console.log('uploading attachment');

    const formData = new FormData();
    formData.set('file', new File([content], filename));
    const res = await fetch(`https://api.trello.com/1/cards/${card.id}/attachments?key=${apiKey}&token=${token}&setCover=${cover}`, {
        method: 'POST',
        body: formData
    });

    console.log(res.status);
}

async function downloadGcodeFile(attachment) {
    const response = await fetch(attachment.url, {
        headers: {
            'Authorization': `OAuth oauth_consumer_key="${apiKey}", oauth_token="${token}"`
        }
    });

    return await response.text();
}

async function updateTimes(updatedLists) {
    const lists = updatedLists;
    
    lists.forEach(list => trello.getCardsForList(list.id)
        .then(cards => {
            let total = 0;

            for (const card of cards) {
                // console.log(card.name);

                const matches = card.name.match(/((\d+)h)?(\d\d)m.gcode/ ) ;
                if (matches) {
                    const hours = parseInt(matches[2]) || 0;
                    const minutes = parseInt(matches[3]);
                    total += (60 * hours + minutes);
                    // console.log(hours, minutes, total);
                }
                if ( skipPreviews.indexOf(card.id) > -1 ) {
                    continue;
                }
            }

            // console.log(total, Math.floor(total / 60), total % 60 );
            const hours = Math.floor(total / 60);
            const minutes = (total % 60) || '00';
            const timeString = `[${hours}h${minutes}m]`;
            // console.log(timeString);
            const regExp = /\[\d+h\d\dm\]/;

            if (list.name.search(regExp) > -1) {
                const newName = list.name.replace(regExp, timeString);
                // console.log('rename', newName)
                trello.renameList(list.id, newName);
            }
        }));
}

router  
    .get('/webhook/board', async ctx => {
        ctx.body = 'Hello webhook';
    })
    .post('/webhook/board', koaBody(), ctx => {
        console.log(ctx.request.body.action.type);
        
        const action = ctx.request.body.action;

        if (action && action.type == 'addAttachmentToCard') {
            if (action?.data?.attachment?.name?.indexOf('gcode') > -1 ) {
                console.log('gcode attachment');

                ensurePreview(action.data.card);
            }
        }
        else if (action && action.type == 'createCard') {
            if (action?.data?.card?.name?.indexOf('gcode') > -1 ) {  
                
                ensurePreview(action.data.card);
            }  
        }
        else if (action && action.type == 'updateCard') {
            if (action.data.listBefore && action.data.listAfter)
                updateTimes([action.data.listBefore, action.data.listAfter]);
        }

        // => POST body
        ctx.body = 'ok';
    });

app
  .use(KoaLogger())
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(PORT, '0.0.0.0', () =>
    console.log(`listening on http://localhost:${PORT}...`)
  );
