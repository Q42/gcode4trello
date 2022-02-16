import * as functions from "firebase-functions";

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const onCardAction = functions.https.onRequest((request, response) => {
    
    functions.logger.info("receive " + request.method, {structuredData: true});
    
    if (request.method == 'HEAD' || request.method == 'GET') {
        response.send("ok");
        return;// 200 OK
    }

    // actual webhook handler
    if (request.method == 'POST') {
        functions.logger.info(request.body, {structuredData: true} );

    }
    //   response.send("");
});
