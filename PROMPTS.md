# יומן פרומפטים

## 2026-11-05

**09:57 · claude**

> Hello, this is a test for the prompts log

**10:15 · claude**

> You will help me create a master-detail app using React and Vite, strictly in typescript. We will first design it together and create a task based implementation plan before we start coding. Start by helping me create a PRD. Save it aside as PRD.md. Key implementation details will be documented in architecture.md. My app is intended for hobbiests who raise chickens and like exploring the variety of breeds and colours. As the source of data, we will use a free API supplying information about different chicken breeds. The user interface will let you see all breeds (master), navigate to a specific breed (detail) and have two extra functions. The first - A favourites page that let's you create a flock of your own, based on the ability to add a certain breed in its details page, once or more (a flock can have a few of the same breed). The second page will be the wishlist of breeds a user wants, based on user choice too. Both states will be saved across sessions per user. Navigation between pages will be done using links in a sidebar. Details will expand and retract in the master page, while favourites and wishlist will be seperate pages.

**10:17 · claude**

> the api we'll use is https://chickenapi.com/swagger-ui/index.html#/. Make sure you're able to access it without authentication or other problems.

**10:33 · claude**

> missing CORS headers is indeed a problem, according to project limitations, i'

**10:44 · claude**

> missing CORS headers is indeed a problem, according to project limitations, i'm not allowed to mitiagte that, so change the app to dealing with dogs instead, and use this api https://dog.ceo/dog-api/documentation/. Since this API's data a bit different, I want the master and the details to expand by sub-breed, that way if there are sub breeds, each of them gets an element and their details will show the sub-breed's image (one random image, using the suitable API endpoint). For sub-breeds of the same breed I want to group them by a tag mentioning the breed they belong to.

**10:55 · claude**

> Before I approve, commit this first version to master. I want to track our progress easily. Commit message should be short. *ONLY DOCUMENTATION SHOULD BE COMMITED DIRECTLY TO MASTER*

**10:56 · claude**

> track PROMPTS.md from now on. Commit it too
