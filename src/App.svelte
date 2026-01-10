<script>
    import ExMarkdown from "svelte-exmarkdown";
    import { onMount, tick } from "svelte";

    // Constantes pour les URLs
    const POCKETBASE_URL = "http://127.0.0.1:8090/api/collections";
    let askinputValue = "";
    let chat = [];
    let isLoading = false;
    let mistralToken = "";
    let showTokenInput = true;
    let tokenInputElement;
    let answerWindowElement;
    let currentConversationId = null;
    let currentConversationTitle = "Nouvelle conversation";
    let conversationsList = [];

    // Onmount :
    onMount(async () => {
        const savedToken = localStorage.getItem("mistralToken");
        if (savedToken) {
            mistralToken = savedToken;
            showTokenInput = false;
        }
        await fetchMessagesFromPocketBase();
        scrollToBottom();
    });

    // Validation clé token :
    function validateToken() {
        const token = tokenInputElement.value.trim();
        // Vérifie si le token est vide ou contient des espaces
        if (!token || token.includes(" ")) {
            alert("Token invalide");
            return;
        }

        mistralToken = token;
        localStorage.setItem("mistralToken", mistralToken);
        tokenInputElement.value = "";
        showTokenInput = false;
        alert("Token enregistré");
    }

    function resetToken() {
        mistralToken = "";
        localStorage.removeItem("mistralToken");
        showTokenInput = true;
        alert("Token réinitialisé. Veuillez entrer un nouveau token.");
    }

    // Scroll to bot auto :
    function scrollToBottom() {
        if (answerWindowElement) {
            answerWindowElement.scrollTop = answerWindowElement.scrollHeight;
        }
    }

    async function createConversation(title) {
        try {
            const response = await fetch(
                `${POCKETBASE_URL}/conversations/records`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title: title,
                    }),
                },
            );

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log("Conversation créée avec succès :", data);
            return data.id; // Retourne l'ID de la nouvelle conversation
        } catch (error) {
            console.error(
                "Erreur lors de la création de la conversation:",
                error,
            );
            throw error;
        }
    }

    async function fetchMessagesFromPocketBase() {
        try {
            const response = await fetch(
                "http://127.0.0.1:8090/api/collections/messages/records?sort=-created",
            );
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            const data = await response.json();
            // Trie les messages par ordre chronologique (du plus ancien au plus récent)
            const sortedMessages = data.items.sort(
                (a, b) =>
                    new Date(a.created).getTime() -
                    new Date(b.created).getTime(),
            );
            // Met à jour le tableau `chat` avec les messages récupérés
            chat = sortedMessages.map((msg) => ({
                id: msg.id,
                text: msg.content,
                role: msg.is_ai_response ? "assistant" : "user",
            }));
        } catch (error) {
            console.error(
                "Erreur lors de la récupération des messages:",
                error,
            );
        }
    }

    async function sendToMistral(question) {
        isLoading = true;
        await tick();
        scrollToBottom();

        console.log("Envoi de la question à Mistral :", question);
        try {
            const response = await fetch(
                "https://api.mistral.ai/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${mistralToken}`,
                    },
                    body: JSON.stringify({
                        model: "mistral-tiny",
                        messages: [{ role: "user", content: question }],
                    }),
                },
            );
            if (!response.ok) {
                if (response.status === 401) {
                    showTokenInput = true;
                    mistralToken = "";
                    localStorage.removeItem("mistralToken");
                    throw new Error(
                        "Token invalide. Veuillez entrer un nouveau token.",
                    );
                }
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            const data = await response.json();
            console.log("Réponse de Mistral :", data);
            return data.choices[0].message.content;
        } catch (error) {
            console.error("Erreur lors de l'appel à l'API Mistral:", error);
            return `Désolé, une erreur est survenue: ${error.message}`;
        } finally {
            isLoading = false;
        }
    }

    async function saveMessageToPocketBase(
        content,
        isAiResponse,
        conversationId,
    ) {
        try {
            console.log("Sauvegarde du message avec :", {
                content,
                isAiResponse,
                conversationId, // Vérifie que cette valeur est correcte
            });
            const response = await fetch(`${POCKETBASE_URL}/messages/records`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    content: content,
                    is_ai_response: isAiResponse,
                    conversation: conversationId,
                }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error("Erreur PocketBase:", responseData);
                throw new Error(
                    `Erreur HTTP: ${response.status} - ${JSON.stringify(responseData)}`,
                );
            }

            console.log("Message sauvegardé dans PocketBase:", responseData);
        } catch (error) {
            console.error(
                "Erreur lors de la sauvegarde dans PocketBase:",
                error,
            );
            alert(`Erreur lors de la sauvegarde du message : ${error.message}`);
        }
    }

    async function handleAsk() {
        const text = askinputValue.trim();
        if (text === "") return;

        console.log(
            "currentConversationId avant création:",
            currentConversationId,
        );

        if (!currentConversationId) {
            const title = prompt(
                "Donnez un titre à cette conversation :",
                "Nouvelle conversation",
            );
            if (title) {
                currentConversationId = await createConversation(title);
                currentConversationTitle = title;
                console.log(
                    "Nouvelle conversation créée avec ID:",
                    currentConversationId,
                );
            } else {
                return; // Annule si l'utilisateur ne donne pas de titre
            }
        }

        chat = [...chat, { id: new Date().getTime(), text, role: "user" }];
        console.log("Chat mis à jour :", chat);
        await saveMessageToPocketBase(text, false, currentConversationId);
        askinputValue = "";
        scrollToBottom();

        try {
            // Envoie la question à Mistral
            const answer = await sendToMistral(text);
            chat = [
                ...chat,
                { id: new Date().getTime(), text: answer, role: "assistant" },
            ];
            await saveMessageToPocketBase(answer, true, currentConversationId);
        } catch (error) {
            chat = [
                ...chat,
                {
                    id: new Date().getTime(),
                    text: error.message,
                    role: "assistant",
                },
            ];
        }

        scrollToBottom();
    }

    async function fetchConversations() {
        try {
            const response = await fetch(
                `${POCKETBASE_URL}/conversations/records?sort=-updated`,
            );
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            const data = await response.json();
            conversationsList = data.items; // Met à jour la variable réactive
            return data.items;
        } catch (error) {
            console.error(
                "Erreur lors de la récupération des conversations:",
                error,
            );
            return [];
        }
    }

    async function fetchMessagesForConversation(conversationId) {
        try {
            console.log(
                "Récupération des messages pour conversationId:",
                conversationId,
            );
            const response = await fetch(
                `${POCKETBASE_URL}/messages/records?sort=created`,
            );
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            const data = await response.json();
            console.log("Tous les messages :", data.items);

            // Filtre les messages en vérifiant si la conversation contient l'ID
            const filteredMessages = data.items.filter(
                (msg) =>
                    msg.conversation &&
                    msg.conversation.length > 0 &&
                    msg.conversation[0] === conversationId,
            );
            console.log("Messages filtrés :", filteredMessages);

            // Trie les messages filtrés
            const sortedMessages = filteredMessages.sort(
                (a, b) =>
                    new Date(a.created).getTime() -
                    new Date(b.created).getTime(),
            );
            return sortedMessages.map((msg) => ({
                id: msg.id,
                text: msg.content,
                role: msg.is_ai_response ? "assistant" : "user",
            }));
        } catch (error) {
            console.error(
                "Erreur lors de la récupération des messages:",
                error,
            );
            return [];
        }
    }

    async function loadConversation(conversationId, title) {
        currentConversationId = conversationId;
        currentConversationTitle = title;
        console.log("Chargement de la conversation avec ID:", conversationId); // Ajoute cette ligne
        const messages = await fetchMessagesForConversation(conversationId);
        console.log("Messages chargés :", messages); // Ajoute cette ligne
        chat = messages;
        scrollToBottom();
    }

    async function deleteConversation(conversationId) {
        try {
            // Supprimer les messages de la conversation
            const messagesResponse = await fetch(
                `${POCKETBASE_URL}/messages/records?filter=(conversation="${conversationId}")`,
            );
            const messages = await messagesResponse.json();

            for (const message of messages.items) {
                await fetch(
                    `${POCKETBASE_URL}/messages/records/${message.id}`,
                    {
                        method: "DELETE",
                    },
                );
            }

            // Supprimer la conversation
            const response = await fetch(
                `${POCKETBASE_URL}/conversations/records/${conversationId}`,
                {
                    method: "DELETE",
                },
            );

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            // Réinitialiser l'interface si la conversation supprimée est la conversation actuelle
            if (currentConversationId === conversationId) {
                currentConversationId = null;
                chat = [];
                currentConversationTitle = "Nouvelle conversation";
            }

            // Recharger la liste des conversations
            return await fetchConversations();
        } catch (error) {
            console.error(
                "Erreur lors de la suppression de la conversation:",
                error,
            );
            alert(
                `Erreur lors de la suppression de la conversation : ${error.message}`,
            );
            return [];
        }
    }
</script>

<div id="container">
    <div id="sidebar">
        <div id="topnav">
            <button
                class="new-chat-button"
                on:click={async () => {
                    const title = prompt(
                        "Donnez un titre à cette conversation :",
                        "Nouvelle conversation",
                    );
                    if (title) {
                        currentConversationId = await createConversation(title);
                        currentConversationTitle = title;
                        chat = [];
                    }
                }}
            >
                New Chat
            </button>
        </div>
        <div id="midnav">
            <div class="conversation-list">
                {#await fetchConversations()}
                    <p>Chargement des conversations...</p>
                {:then conversations}
                    {#if conversations.length === 0}
                        <p>Aucune conversation existante.</p>
                    {:else}
                        {#each conversationsList as conversation}
                            <div class="conversation-item-container">
                                <button
                                    class="conversation-item {currentConversationId ===
                                    conversation.id
                                        ? 'active'
                                        : ''}"
                                    on:click={() =>
                                        loadConversation(
                                            conversation.id,
                                            conversation.title,
                                        )}
                                >
                                    {conversation.title}
                                </button>
                                <button
                                    class="delete-conversation-button"
                                    on:click={(e) => {
                                        e.stopPropagation();
                                        if (
                                            confirm(
                                                "Voulez-vous vraiment supprimer cette conversation ?",
                                            )
                                        ) {
                                            deleteConversation(conversation.id);
                                        }
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        {/each}
                    {/if}
                {/await}
            </div>
        </div>
        <div id="botnav">
            {#if showTokenInput}
                <input
                    type="text"
                    id="tokeninput"
                    placeholder="Token"
                    bind:this={tokenInputElement}
                    spellcheck="false"
                />
                <input
                    type="button"
                    class="tokenbutton"
                    value="Add key"
                    on:click={validateToken}
                />
            {/if}
            {#if !showTokenInput}
                <input
                    type="button"
                    class="tokenbutton"
                    value="Reset token"
                    on:click={resetToken}
                />
            {/if}
        </div>
    </div>
    <div id="chatwindows">
        <div
            class="windowchat"
            id="answerwindow"
            bind:this={answerWindowElement}
        >
            {#if chat.length === 0}
                <p>No chat yet.</p>
            {:else}
                {#each chat as message}
                    <div class="message {message.role}">
                        {#if message.role === "assistant"}
                            <ExMarkdown md={message.text} />
                        {:else}
                            <span>{message.text}</span>
                        {/if}
                    </div>
                {/each}
            {/if}
            {#if isLoading}
                <p>Mistral is loading...</p>
            {/if}
        </div>
        <div id="askgroup">
            <input
                type="text"
                class="windowchat"
                id="askwindow"
                placeholder="Quelle est votre question ?"
                bind:value={askinputValue}
                on:keydown={(e) => e.key === "Enter" && handleAsk()}
                spellcheck="false"
            />
            <input
                type="button"
                id="askbutton"
                value="Ask"
                on:click={handleAsk}
                disabled={isLoading}
            />
        </div>
    </div>
</div>

<style>
    #container {
        display: flex;
        flex-direction: row;
        width: 100%;
        height: 650px;
    }

    #sidebar {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        background-color: rgb(200, 200, 200);
        margin: 1rem;
        padding: 1rem;
        width: 15%;
        border-radius: 5px;
    }

    .article {
        color: white;
        margin: 1rem;
        padding: 1rem;
        border-radius: 5px;
        width: 100%;
        height: auto;
        text-align: center;
        box-sizing: border-box;
    }

    #chatwindows {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        background-color: rgb(200, 200, 200);
        margin: 1rem;
        padding: 1rem;
        width: 80%;
        border-radius: 5px;
    }

    #answerwindow {
        align-items: center;
        background-color: #82b74b;
        padding: 1rem;
        width: 80%;
        height: 90%;
        border-radius: 5px;
        text-align: left;
        overflow-y: scroll;
    }

    #askgroup {
        display: flex;
        align-items: center;
        flex-direction: row;
        justify-content: space-between;
        width: 80%;
        margin: 1rem;
        padding: 1rem;
    }

    #askwindow {
        background-color: rgb(255, 255, 255);
        margin: 1rem;
        padding: 1rem;
        width: 80%;
        border-radius: 5px;
    }

    #askbutton {
        margin: 1rem;
        margin-left: 1rem;
        padding: 1rem;
        width: 30%;
        background-color: #3e4444;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    #askbutton:hover {
        background-color: #405d27;
    }

    @media (max-width: 700px) {
        #container {
            display: flex;
            flex-direction: column;
        }

        #sidebar {
            width: 80%;
        }

        #chatwindows {
            height: 80%;
        }

        #askgroup {
            flex-direction: column;
            width: 100%;
        }
        #askbutton {
            width: 30%;
            min-width: 60px;
        }
    }

    /* Jour 2 */

    .message {
        border: 1px solid #ccc;
        padding: 1rem;
        margin: 0.3rem;
        border-radius: 20px;
    }

    .user {
        background-color: rgb(255, 255, 255);
        color: #333;
        margin-left: auto;
    }

    .assistant {
        background-color: #405d27;
        color: white;
        margin-right: auto;
    }

    #answerwindow {
        display: flex;
        flex-direction: column;
        width: 90%;
    }

    #tokeninput {
        margin: 1rem;
        padding: 1rem;
        width: 80%;
        height: auto;
    }

    .tokenbutton {
        font-size: 0.7rem;
        margin: 0.5rem;
        padding: 0.5rem;
        width: 80%;
        min-width: 100px;
        max-width: 200px;
        background-color: rgb(255, 255, 255);
        color: rgb(0, 0, 0);
        cursor: pointer;
    }

    #topnav {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 1rem 0;
    }

    #botnav {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 1rem;
        margin: 0.5rem;
    }

    /*jeudi aprem*/

    .new-chat-button {
        padding: 0.75rem;
        background-color: #c1946a;
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        margin-bottom: 1rem;
        width: 100%;
        max-width: 200px;
    }

    .conversation-item {
        flex: 1;
        text-align: left;
        width: 100%;
        padding: 0.75rem;
        text-align: left;
        background: none;
        border: none;
        cursor: pointer;
        border-radius: 0.25rem;
        margin-bottom: 0.25rem;
        border-radius: 5px;
    }

    .conversation-item:hover {
        background-color: #e9ecef;
    }

    .conversation-item.active {
        background-color: #3e4444;
        color: white;
    }
    #midnav {
        overflow-y: scroll;
    }

    .conversation-item-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin-bottom: 0.5rem;
    }

    .delete-conversation-button {
        background: none;
        border: none;
        color: #8d2121;
        border-radius: 50%;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0 0.2rem;
        margin: 0.2rem;
    }

    .delete-conversation-button:hover {
        background-color: #b69797;
    }
</style>
