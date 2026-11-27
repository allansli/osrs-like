import type { Cond, Dialogue, DialogueOption } from '../state/dialogue';

// Stage 6, slice 2 (Q6, design 7.2 and 7.3): what the seven people say. Every passage is data: at most 280 characters,
// an option at most 80, at most four options a node. A greet list is read top to bottom: hand-ins first, then the
// stage a quest waits at, then offers, then the idle line, which has no condition.

/** Chapter 1 is offered when the starter chain is finished, or at once to a save that never had the chain. */
const CHAIN_OVER: Cond = { any: [{ claimed: 'sq_coin' }, { not: { claimed: 'arrival' } }] };
const WARDS_NEEDS: Cond = { all: [{ quest: ['ml_wards', 'none'] }, CHAIN_OVER] };
const EAST_NEEDS: Cond = { all: [{ quest: ['ml_east', 'none'] }, { quest: ['ml_wards', 'done'] }, { combat: 15 }] };
const STEEL_NEEDS: Cond = { all: [{ quest: ['sq_steel', 'none'] }, { quest: ['ml_east', 'done'] }, { combat: 10 }] };
const KETTLE_NEEDS: Cond = { all: [{ quest: ['sq_kettle', 'none'] }, { skill: ['cooking', 30] }, { combat: 20 }] };
const VOW_NEEDS: Cond = { all: [{ quest: ['sq_vow', 'none'] }, { combat: 15 }] };
const TOLL_NEEDS: Cond = { all: [{ quest: ['sq_toll', 'none'] }, { combat: 40 }] };

const WHAT_ARE_WARDS: DialogueOption = { text: 'What are the wards?', goto: 'wards_what' };
const OTHER_WORK: DialogueOption = { text: 'Is there other work?', when: VOW_NEEDS, goto: 'vow_offer' };
const USE_FORGE: DialogueOption = { text: 'Let me use the forge.', then: [{ open: 'forge' }], goto: 'end' };
const SEE_WARES: DialogueOption = { text: 'Show me what you sell.', then: [{ open: 'shop' }], goto: 'end' };

// Bran Tolley, Gatewarden: blunt, kind, short sentences. He gives Stage 3's starter chain a voice and changes nothing in it.
const BRAN: Dialogue = {
  npc: 'bran_tolley',
  greet: [
    { when: { starter: ['sq_ledger', 'ready'] }, node: 'ledger_ready' },
    { when: { starter: ['sq_ledger', 'open'] }, node: 'ledger_open' },
    { when: { starter: ['sq_quarrel', 'ready'] }, node: 'quarrel_ready' },
    { when: { starter: ['sq_quarrel', 'open'] }, node: 'quarrel_open' },
    { when: { starter: ['sq_gather', 'ready'] }, node: 'gather_ready' },
    { when: { starter: ['sq_gather', 'open'] }, node: 'gather_open' },
    { when: { starter: ['sq_forge', 'ready'] }, node: 'forge_ready' },
    { when: { starter: ['sq_forge', 'open'] }, node: 'forge_open' },
    { when: { starter: ['sq_keeping', 'ready'] }, node: 'keeping_ready' },
    { when: { starter: ['sq_keeping', 'open'] }, node: 'keeping_open' },
    { when: { starter: ['sq_coin', 'ready'] }, node: 'coin_ready' },
    { when: { starter: ['sq_coin', 'open'] }, node: 'coin_open' },
    { when: { stage: ['sq_toll', 2] }, node: 'toll_done' },
    { when: { stage: ['sq_toll', 0] }, node: 'toll_brief' },
    { when: { stage: ['sq_toll', 1] }, node: 'toll_wait' },
    { when: { all: [{ not: { claimed: 'arrival' } }, { quest: ['ml_wards', 'none'] }] }, node: 'veteran' },
    { when: { quest: ['ml_wards', 'none'] }, node: 'gate_new' },
    { node: 'gate' }
  ],
  nodes: {
    ledger_open: {
      say: "Name, and what you carry. Nothing? Then you will fit in. Put your name in the task master's ledger and I will find you a blade.",
      options: [
        { text: 'Where is the task master?', goto: 'ledger_where' },
        { text: 'Who are you?', goto: 'bran_who' },
        { text: 'I will sign the ledger.', goto: 'end' }
      ]
    },
    ledger_where: {
      say: 'Behind me, by the bank. Big ledger, short temper. Take whatever work is going. The ledger does not care what it is, and today neither do you.',
      options: [{ text: 'I will go and sign.', goto: 'end' }]
    },
    ledger_ready: {
      say: 'The ledger has your name. I looked. So here is the blade I promised. Bronze. It has an edge, mostly.',
      options: [
        { text: 'It is done.', when: { starter: ['sq_ledger', 'ready'] }, then: [{ claimStarter: 'sq_ledger' }], goto: 'quarrel_open' },
        { text: 'Hold it for me a while.', goto: 'end' }
      ]
    },
    quarrel_open: {
      say: 'The camp across the green takes our hens. Every night, one fewer. Go over there and settle one quarrel. One. I am not asking for a war.',
      options: [
        { text: 'What am I fighting?', goto: 'quarrel_what' },
        { text: 'Who are you?', goto: 'bran_who' },
        { text: 'One quarrel. Understood.', goto: 'end' }
      ]
    },
    quarrel_what: {
      say: 'Small. Green. Loud. They hit harder in a crowd, so do not give them one. Pick the one at the edge of the camp and keep your feet moving.',
      options: [{ text: 'The one at the edge. Right.', goto: 'end' }]
    },
    quarrel_ready: {
      say: 'One fewer of them, then. The hens thank you. I have cooked fish and a few coins put by for whoever did it. That is you.',
      options: [
        { text: 'It is done.', when: { starter: ['sq_quarrel', 'ready'] }, then: [{ claimStarter: 'sq_quarrel' }], goto: 'gather_open' },
        { text: 'Hold it for me a while.', goto: 'end' }
      ]
    },
    gather_open: {
      say: 'Nobody feeds you here. You dig it, you cut it or you catch it. Do all three once. Ore from a rock, a tree brought down, a fish out of the water. Then you will know which one you hate.',
      options: [
        { text: 'Where do I find all that?', goto: 'gather_where' },
        { text: 'Who are you?', goto: 'bran_who' },
        { text: 'Stone, timber, tide. Right.', goto: 'end' }
      ]
    },
    gather_where: {
      say: 'Close. Rocks, trees and water are all a short walk from this gate. If you can still see the castle, you have not gone too far. If you cannot, turn round.',
      options: [{ text: 'I will stay in sight of the castle.', goto: 'end' }]
    },
    gather_ready: {
      say: 'Dirt on your hands, sap on your sleeve, and you smell of fish. Good. That head did some thinking today. Here is a helm to keep it in.',
      options: [
        { text: 'It is done.', when: { starter: ['sq_gather', 'ready'] }, then: [{ claimStarter: 'sq_gather' }], goto: 'forge_open' },
        { text: 'Hold it for me a while.', goto: 'end' }
      ]
    },
    forge_open: {
      say: 'Cook that fish before it turns. Then the forge. Smelt bronze, five bars. Two make legs, three make a body. Make the body and wear it. I want to hear you coming.',
      options: [
        { text: 'Where is the forge?', goto: 'forge_where' },
        { text: 'Who are you?', goto: 'bran_who' },
        { text: 'Fire and hammer. I am going.', goto: 'end' }
      ]
    },
    forge_where: {
      say: 'North-east of the bank. Forge and range share a roof. Pell Greaves cooks there. He will tell you that you are doing it wrong. He is usually right.',
      options: [{ text: 'I will find it.', goto: 'end' }]
    },
    forge_ready: {
      say: 'I heard you before I saw you. That is the idea. Plate on the chest. Now something for the arm. It is only wood, but wood has stopped worse than you will meet this week.',
      options: [
        { text: 'It is done.', when: { starter: ['sq_forge', 'ready'] }, then: [{ claimStarter: 'sq_forge' }], goto: 'keeping_open' },
        { text: 'Hold it for me a while.', goto: 'end' }
      ]
    },
    keeping_open: {
      say: 'The bank keeps what you cannot carry. Go and open it. A traveller before you left a thing in keeping and did not come back for it. It goes to the next name in my count. Yours.',
      options: [
        { text: 'Who left it?', goto: 'keeping_who' },
        { text: 'Who are you?', goto: 'bran_who' },
        { text: 'I will open the bank.', goto: 'end' }
      ]
    },
    keeping_who: {
      say: 'Gave no name. Went south, up Cinder Stair, with a staff and a full pack. I counted them out. I have not counted them in.',
      options: [{ text: 'I will open the bank.', goto: 'end' }]
    },
    keeping_ready: {
      say: 'You opened it. So the clerk sent this over. A hazel staff, and runes to feed it. They will do more in your hands than in a box.',
      options: [
        { text: 'It is done.', when: { starter: ['sq_keeping', 'ready'] }, then: [{ claimStarter: 'sq_keeping' }], goto: 'coin_open' },
        { text: 'Hold it for me a while.', goto: 'end' }
      ]
    },
    coin_open: {
      say: 'Last thing. Sell what you do not need. Buy what you do. That is how the next kit gets paid for. I gave you the first one. Nobody gives you the second.',
      options: [
        { text: 'Where do I trade?', goto: 'coin_where' },
        { text: 'Who are you?', goto: 'bran_who' },
        { text: 'Fair coin. I will trade.', goto: 'end' }
      ]
    },
    coin_where: {
      say: 'The store, west of the bank. He buys nearly anything and pays less than you hope. Iron is the next kit. It wants Attack and Defence five, and coin or a forge.',
      options: [{ text: 'I will go to the store.', goto: 'end' }]
    },
    coin_ready: {
      say: 'Sold one thing, bought another. Now you know what coin is for. Boots. You will walk a long way from this gate, and I want you to walk back.',
      options: [
        { text: 'It is done.', when: { starter: ['sq_coin', 'ready'] }, then: [{ claimStarter: 'sq_coin' }], goto: 'gate_new' },
        { text: 'Hold it for me a while.', goto: 'end' }
      ]
    },
    gate_new: {
      say: 'That is all I have for you. You are counted in. Odalys Venn has been asking who is new. She stands by the altar, north of the store. Go and be new at her.',
      options: [
        { text: 'Who is Odalys Venn?', goto: 'bran_odalys' },
        { text: 'Any trouble on the roads?', goto: 'bran_roads' },
        { text: 'I will find her.', goto: 'end' }
      ]
    },
    veteran: {
      say: 'You were here before I had this post. So I do not count you in. I count you back. Odalys Venn wants hands, old ones included. By the altar, north of the store.',
      options: [
        { text: 'Who is Odalys Venn?', goto: 'bran_odalys' },
        { text: 'Any trouble on the roads?', goto: 'bran_roads' },
        { text: 'What is your post?', goto: 'bran_who' },
        { text: 'Good to see the gate kept.', goto: 'end' }
      ]
    },
    gate: {
      say: 'Tolley. Gate. You are counted, so walk through.',
      options: [
        { text: 'Any trouble on the roads?', goto: 'bran_roads' },
        { text: 'Who are you, Tolley?', goto: 'bran_who' },
        { text: 'Keep counting.', goto: 'end' }
      ]
    },
    bran_roads: {
      say: 'South, beside Cinder Stair, ash-touched things that were not there last year. North, a brute who thinks he owns the road. East and west, the usual.',
      options: [
        { text: 'Tell me about the brute in the north.', when: TOLL_NEEDS, goto: 'toll_offer' },
        { text: 'Who is the brute in the north?', when: { all: [{ quest: ['sq_toll', 'none'] }, { not: { combat: 40 } }] }, goto: 'toll_early' },
        { text: 'What ash-touched things?', goto: 'bran_ash' },
        { text: 'I will watch the roads.', goto: 'end' }
      ]
    },
    bran_ash: {
      say: 'Robed ones that throw fire. Big ones crusted in slag. South of here, off the Stair. The road itself is safe. Step off it and it is not. Ask the Lampwright why. I only count.',
      options: [{ text: 'I will stay on the road.', goto: 'end' }]
    },
    toll_early: {
      say: 'Marrowjaw. Calls himself the Tollmaster. He would fold you in half and charge you for the trouble. Come back when the task master rates you at combat forty and I will say more.',
      options: [{ text: 'Forty. I will come back.', goto: 'end' }]
    },
    toll_offer: {
      say: 'Marrowjaw. Calls himself the Tollmaster. Sits on the open ground far north and takes a toll from anyone who passes. Coin or teeth. I have counted four traders out that way and none back in. I want it stopped.',
      options: [
        { text: 'I will stop it.', when: TOLL_NEEDS, then: [{ start: 'sq_toll' }], goto: 'toll_brief' },
        { text: 'Not today.', goto: 'end' }
      ]
    },
    toll_brief: {
      say: 'Good. Listen, then. He is slow, and he shows you the big swing before it comes. Watch his arms, not his mouth. When both go up, be somewhere else. Go armed. Go fed.',
      options: [
        { text: 'Arms, not mouth. I am going.', when: { stage: ['sq_toll', 0] }, then: [{ advance: 'sq_toll' }], goto: 'end' },
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    toll_wait: {
      say: 'He is still up there. I know because nobody has come down that road all week. North. Past the castle, and keep walking until the ground opens out.',
      options: [
        { text: 'I am on my way.', goto: 'end' },
        { text: 'Something else, Tolley.', goto: 'gate' }
      ]
    },
    toll_done: {
      say: 'A trader came in by the north road this morning. First in a month. Paid no toll. I counted her in myself. So. You did it.',
      options: [
        { text: 'The toll is lifted.', when: { stage: ['sq_toll', 2] }, then: [{ finish: 'sq_toll' }], goto: 'toll_after' },
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    toll_after: {
      say: 'Tollbreaker. They will call you that at this gate, because I will tell them to. The traders put this purse together. The ember is from the Lampwright. Hold it, think of a trade, and it teaches you some. Her words.',
      options: [{ text: 'Thank you, Tolley.', goto: 'end' }]
    },
    bran_who: {
      say: 'Bran Tolley. Gatewarden. I count people out and I count them in. The second number should match the first. Lately it does not.',
      options: [
        { text: 'Why not?', goto: 'bran_why' },
        { text: 'Then keep counting.', goto: 'end' }
      ]
    },
    bran_why: {
      say: 'Ask the roads. Ask the lamps. Ask Odalys Venn, she is the one who knows lamps. I know heads. Yours is still on. Keep it that way.',
      options: [
        { text: 'Who is Odalys Venn?', goto: 'bran_odalys' },
        { text: 'I will.', goto: 'end' }
      ]
    },
    bran_odalys: {
      say: 'The last Lampwright. She tends the wardlights on the roads. There was a guild of them once. Now there is her, and she is not young. Sharp, and tired. Do not waste her time.',
      options: [{ text: 'I will not.', goto: 'end' }]
    }
  }
};

// Odalys Venn, the last Lampwright: dry, tired, exact. She talks about the lights as if they were patients.
const ODALYS: Dialogue = {
  npc: 'odalys_venn',
  greet: [
    { when: { stage: ['ml_east', 4] }, node: 'east_done' },
    { when: { all: [{ stage: ['ml_wards', 2] }, { has: ['ashes', 3] }] }, node: 'wards_take' },
    { when: { stage: ['sq_vow', 2] }, node: 'vow_done' },
    { when: { stage: ['ml_wards', 0] }, node: 'wards_brief' },
    { when: { stage: ['sq_vow', 0] }, node: 'vow_brief' },
    { when: { stage: ['ml_wards', 2] }, node: 'wards_short' },
    { when: { stage: ['ml_wards', 1] }, node: 'wards_wait' },
    { when: { stage: ['ml_wards', 3] }, node: 'wards_cairn' },
    { when: WARDS_NEEDS, node: 'wards_offer' },
    { when: { quest: ['ml_wards', 'none'] }, node: 'early' },
    { when: { quest: ['ml_east', 'none'] }, node: 'east_point' },
    // Below the offer and the pointer of the main line, so a vow that waits never hides the next chapter.
    { when: { stage: ['sq_vow', 1] }, node: 'vow_wait' },
    { when: { quest: ['ml_east', 'active'] }, node: 'east_wait' },
    { node: 'idle' }
  ],
  nodes: {
    early: {
      say: "You are still on Tolley's list. Finish what he gives you. He is teaching you to feed yourself, and I have no use for anyone who cannot.",
      options: [WHAT_ARE_WARDS, { text: 'Who are you?', goto: 'odalys_who' }, OTHER_WORK, { text: 'I will come back.', goto: 'end' }]
    },
    wards_offer: {
      say: 'Tolley sent you. Good. He counts people and I look at them, and you will do. Three wardlights on three roads are guttering, and I am one woman with one pair of knees. I need hands.',
      options: [
        { text: 'What do you need?', when: WARDS_NEEDS, then: [{ start: 'ml_wards' }], goto: 'wards_brief' },
        WHAT_ARE_WARDS,
        { text: 'Who are you?', goto: 'odalys_who' },
        { text: 'Not now.', goto: 'end' }
      ]
    },
    wards_brief: {
      say: 'A wardlight burns ash to keep ash away, the way you bleed a fever. The town lamp is nearly out of it. Burn three logs at any forge and bring me what is left. Three measures of ashes. Do not sift them.',
      options: [
        { text: 'Three measures of ashes. I will bring them.', when: { stage: ['ml_wards', 0] }, then: [{ advance: 'ml_wards' }], goto: 'end' },
        WHAT_ARE_WARDS,
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    wards_wait: {
      say: 'No ashes yet. The lamp is patient. It has to be, it cannot walk. Three logs, any forge, and bring me what is left in the pan.',
      options: [{ text: 'I am gathering them.', goto: 'end' }, WHAT_ARE_WARDS, OTHER_WORK]
    },
    wards_short: {
      say: 'You had the ashes and now you do not. I will not ask where they went. Three measures, in your hands, when you stand here.',
      options: [{ text: 'I will burn more.', goto: 'end' }, WHAT_ARE_WARDS, OTHER_WORK]
    },
    wards_take: {
      say: 'That is the smell. Give them here. I will feed the town lamp tonight, and it will hold its colour for a month. Perhaps two, if the wind is kind.',
      options: [
        {
          text: 'Here are the ashes.',
          when: { all: [{ stage: ['ml_wards', 2] }, { has: ['ashes', 3] }] },
          then: [{ take: ['ashes', 3] }, { advance: 'ml_wards' }],
          goto: 'wards_cairn'
        },
        WHAT_ARE_WARDS,
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    wards_cairn: {
      say: 'One lamp fed. Now walk Cinder Stair south, as far as Wardstone Cairn and no farther. It stands before the pass. Corin Ashby keeps it. Tell him the town lamp holds, and look at what he looks at all day. Stay on the road.',
      options: [{ text: 'I will find Corin Ashby.', goto: 'end' }, WHAT_ARE_WARDS, OTHER_WORK]
    },
    wards_what: {
      say: 'A wardlight does not keep monsters out. It keeps the ash from settling. The monsters are what the ash leaves behind.',
      options: [
        { text: 'Where does the ash come from?', goto: 'wards_ash' },
        { text: 'Who tends the lights?', goto: 'wards_who' },
        { text: 'How many are there?', goto: 'wards_roads' },
        { text: 'That is enough for now.', goto: 'end' }
      ]
    },
    wards_ash: {
      say: 'From behind Harrowback Ridge. It always did, a little, and a lamp on each road was enough. This year a lamp burns a season of fuel in a month. Something back there has woken, and it breathes out.',
      options: [
        { text: 'How do you know a lamp is failing?', goto: 'wards_sick' },
        { text: 'Who tends the lights?', goto: 'wards_who' },
        { text: 'I understand.', goto: 'end' }
      ]
    },
    wards_sick: {
      say: 'By the colour. A sound wardlight is the yellow of fresh butter. A sick one goes white at the edge and gutters with no wind on it. You listen, too. A sound one hums. Three of mine have stopped humming.',
      options: [
        { text: 'How many are there?', goto: 'wards_roads' },
        { text: 'I will keep an eye on them.', goto: 'end' }
      ]
    },
    wards_who: {
      say: 'Lampwrights. There were forty when I was apprenticed. We walked the roads with a ladder and a satchel. Now there is a satchel, and me, and I do not climb ladders. So I ask whoever Tolley counts in.',
      options: [
        { text: 'Where does the ash come from?', goto: 'wards_ash' },
        { text: 'Then I will be your ladder.', goto: 'end' }
      ]
    },
    wards_roads: {
      say: 'Four roads, and a lamp for each. Millrace Road east. Saltwind Track down to the sand. The Lanternway west, into the trees. Cinder Stair south, to the cairn. And the town lamp, which the others are lit from.',
      options: [
        { text: 'How do you know a lamp is failing?', goto: 'wards_sick' },
        { text: 'Who tends the lights?', goto: 'wards_who' },
        { text: 'Thank you.', goto: 'end' }
      ]
    },
    odalys_who: {
      say: 'Odalys Venn. Lampwright. The last one, which is not a title, only arithmetic. I keep the lights on the roads alive the way you keep an old dog alive. By paying attention.',
      options: [WHAT_ARE_WARDS, { text: 'I will let you work.', goto: 'end' }]
    },
    east_point: {
      say: 'The east lamp is next. Its flame is sound but the bracket has rusted through, and a lamp on the ground lights nothing. Tamsin Reeve at the east forge can make one. She sends nobody for coal below combat fifteen.',
      options: [{ text: 'I will go to the east forge.', goto: 'end' }, WHAT_ARE_WARDS, OTHER_WORK]
    },
    east_wait: {
      say: 'Tamsin Reeve has you fetching and smelting, I hear. Good. Do not let her talk you into staying. The lamp needs its bracket more than she needs an apprentice.',
      options: [{ text: 'I will be back with news.', goto: 'end' }, WHAT_ARE_WARDS, OTHER_WORK]
    },
    east_done: {
      say: 'I saw it from here last night. The east light, steady, and the right colour. The first time since spring. Tell me it is on its bracket and I will believe my eyes.',
      options: [
        { text: 'It is on its bracket. Steel. It will hold.', when: { stage: ['ml_east', 4] }, then: [{ finish: 'ml_east' }], goto: 'east_after' },
        WHAT_ARE_WARDS,
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    east_after: {
      say: 'Two lamps holding. Here is the guild fee, and an ember from the lamp itself. Hold it, think of a craft, and it will teach you a little of it. The south-east road is next. It is not ready for you, nor you for it.',
      options: [
        { text: 'When will it be?', goto: 'idle' },
        { text: 'Thank you, Lampwright.', goto: 'end' }
      ]
    },
    idle: {
      say: 'Two lamps hold. Saltwind Track is next, and the caravans on it are late. When Qadir Salt-Hand sends word, I will want you. Until then, get stronger. I mean that kindly.',
      options: [WHAT_ARE_WARDS, OTHER_WORK, { text: 'Who are you?', goto: 'odalys_who' }, { text: 'I will be ready.', goto: 'end' }]
    },
    vow_offer: {
      say: 'A Lantern Vow. You swear it at an altar and pay what the lamp asks. If you fall, the vow is spent and you keep what you have learned. I have not heard one sworn in a year. I want to know the altars still answer.',
      options: [
        { text: 'I will swear one and tell you.', when: VOW_NEEDS, then: [{ start: 'sq_vow' }], goto: 'vow_brief' },
        { text: 'What does it cost?', goto: 'vow_cost' },
        { text: 'Not now.', goto: 'end' }
      ]
    },
    vow_cost: {
      say: 'More as you grow. The lamp weighs what you stand to lose and asks a share of it in coin. The altar will name the sum. It is honest, which is more than I can say for most prices.',
      options: [
        { text: 'I will swear one and tell you.', when: VOW_NEEDS, then: [{ start: 'sq_vow' }], goto: 'vow_brief' },
        { text: 'I will think about it.', goto: 'end' }
      ]
    },
    vow_brief: {
      say: 'Any altar will do. There is one at my elbow. Swear the vow, then come and tell me how the flame took it. If it gutters when you swear, I need to know before someone relies on it in the pass.',
      options: [
        { text: 'I will swear it.', when: { stage: ['sq_vow', 0] }, then: [{ advance: 'sq_vow' }], goto: 'end' },
        WHAT_ARE_WARDS,
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    vow_wait: {
      say: 'No vow sworn yet. Any altar, and bring the coin it asks. I would do it myself, but the lamp knows I am not going anywhere dangerous.',
      options: [{ text: 'I will see to it.', goto: 'end' }, WHAT_ARE_WARDS]
    },
    vow_done: {
      say: 'So it is sworn. Then the altars still answer, and that is one thing I can stop lying awake over. How did the flame take it?',
      options: [
        { text: 'Clean and steady.', when: { stage: ['sq_vow', 2] }, then: [{ finish: 'sq_vow' }], goto: 'vow_after' },
        WHAT_ARE_WARDS,
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    vow_after: {
      say: 'Clean and steady. Good. The guild used to pay for that news, so I will. When you go where you might not come back from, swear another first. That is advice, not lamp lore.',
      options: [{ text: 'I will remember.', goto: 'end' }]
    }
  }
};

// Tamsin Reeve, master smith: impatient with talk, patient with metal.
const TAMSIN: Dialogue = {
  npc: 'tamsin_reeve',
  greet: [
    { when: { all: [{ stage: ['ml_east', 3] }, { has: ['steel_bar', 2] }] }, node: 'east_take' },
    { when: { stage: ['sq_steel', 2] }, node: 'steel_done' },
    { when: { stage: ['ml_east', 0] }, node: 'east_brief' },
    { when: { stage: ['sq_steel', 0] }, node: 'steel_brief' },
    { when: { stage: ['ml_east', 3] }, node: 'east_short' },
    { when: { stage: ['ml_east', 1] }, node: 'east_coal' },
    { when: { stage: ['ml_east', 2] }, node: 'east_smelt' },
    { when: { stage: ['ml_east', 4] }, node: 'east_sent' },
    { when: { stage: ['sq_steel', 1] }, node: 'steel_wait' },
    { when: EAST_NEEDS, node: 'east_offer' },
    { when: STEEL_NEEDS, node: 'steel_offer' },
    { when: { all: [{ quest: ['ml_wards', 'done'] }, { quest: ['ml_east', 'none'] }] }, node: 'east_early' },
    { when: { quest: ['sq_steel', 'done'] }, node: 'after_all' },
    { node: 'hello' }
  ],
  nodes: {
    hello: {
      say: 'Forge is hot. Tongs are on the rack. Do not touch the blue ones. If you came to talk, I am busy. If you came to work metal, go on.',
      options: [USE_FORGE, { text: 'Who are you?', goto: 'tamsin_who' }, { text: 'I will leave you to it.', goto: 'end' }]
    },
    tamsin_who: {
      say: 'Reeve. Master smith. Any fool can pour bronze and iron. I make the metals in between, the ones this town forgot when the coal carts stopped. Steel. Blacksteel. Ask me when you have a reason.',
      options: [
        { text: 'Why did the coal carts stop?', goto: 'tamsin_coal' },
        { text: 'What is wrong with the blue tongs?', goto: 'tamsin_tongs' },
        USE_FORGE,
        { text: 'Understood.', goto: 'end' }
      ]
    },
    tamsin_coal: {
      say: 'The carters stopped coming when the road lamp went dim. Nobody says they were afraid. They say the mule was lame, the axle was split, the wife was ill. Six carters, six lame mules. The seams are still there.',
      options: [USE_FORGE, { text: 'Someone should dig them.', goto: 'end' }]
    },
    tamsin_tongs: {
      say: 'Nothing. They are perfect. I made them the year I made master, and they have never dropped a bar. That is what is wrong with them. Use the black ones.',
      options: [USE_FORGE, { text: 'The black ones. Yes.', goto: 'end' }]
    },
    east_early: {
      say: 'The Lampwright sent you. I can tell by the look of someone given a job they do not understand yet. I need coal, and the way to the seams is not kind. Come back at combat fifteen and I will send you.',
      options: [USE_FORGE, { text: 'Who are you?', goto: 'tamsin_who' }, { text: 'Fifteen. I will come back.', goto: 'end' }]
    },
    east_offer: {
      say: 'The Lampwright sent you. About time. Her east lamp hangs on an iron bracket, and iron rots. It wants steel. Steel wants coal. Nobody has brought me coal since the carts stopped. You have legs.',
      options: [
        { text: 'Tell me what to do.', when: EAST_NEEDS, then: [{ start: 'ml_east' }], goto: 'east_brief' },
        USE_FORGE,
        { text: 'Not now.', goto: 'end' }
      ]
    },
    east_brief: {
      say: 'Coal seams, east of here, past the last wall. Black rock, greasy to the touch. Four lumps. Then one iron ore and one coal to a bar, here or at any forge. Two bars. Bring me the bars, not the story.',
      options: [
        { text: 'Four coal, then two steel bars.', when: { stage: ['ml_east', 0] }, then: [{ advance: 'ml_east' }], goto: 'end' },
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    east_coal: {
      say: 'No coal yet? East, past the last wall. You want the black seams, not the grey rock. If your pick bounces off, you are not miner enough. Keep at the iron until you are.',
      options: [{ text: 'I am on it.', goto: 'end' }, USE_FORGE]
    },
    east_smelt: {
      say: 'You have dug the coal. Now the fire. One iron ore, one coal, one bar. Twice. And keep the bars. I cannot hang a lamp on a story about two bars you used to have.',
      options: [USE_FORGE, { text: 'I will smelt them.', goto: 'end' }]
    },
    east_short: {
      say: 'You smelted two and you are holding fewer. Made yourself a sword, did you? I would have. Two steel bars, in your hands, and then we talk.',
      options: [USE_FORGE, { text: 'I will smelt more.', goto: 'end' }]
    },
    east_take: {
      say: 'Let me see. Hm. The grain is coarse. You poured too fast. But it is steel, and it will hold a lamp for a hundred years, which the iron did not. Hand them over.',
      options: [
        {
          text: 'Here. Two steel bars.',
          when: { all: [{ stage: ['ml_east', 3] }, { has: ['steel_bar', 2] }] },
          then: [{ take: ['steel_bar', 2] }, { advance: 'ml_east' }],
          goto: 'east_sent'
        },
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    east_sent: {
      say: 'The bracket goes up tonight. I hang it myself. Nobody else touches my welds. Go and tell the Lampwright her light is off the ground. She will want to hear it from the one who carried the coal.',
      options: [{ text: 'I will tell Odalys Venn.', goto: 'end' }, USE_FORGE]
    },
    steel_offer: {
      say: 'The bracket holds. I checked it twice. You pour too fast, but you listen, so here is the next thing. Steel is where this town stopped. It does not have to. Put a steel bar back in the fire with more coal and you get blacksteel.',
      options: [
        { text: 'Teach me.', when: STEEL_NEEDS, then: [{ start: 'sq_steel' }], goto: 'steel_brief' },
        USE_FORGE,
        { text: 'Later.', goto: 'end' }
      ]
    },
    steel_brief: {
      say: 'One steel bar, one coal, one blacksteel bar. It comes out dark and it rings lower. Then forge something from it. A blade, legs, a body, I do not care which. Come and tell me what it taught you.',
      options: [
        { text: 'I will forge a blacksteel piece.', when: { stage: ['sq_steel', 0] }, then: [{ advance: 'sq_steel' }], goto: 'end' },
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    steel_wait: {
      say: 'Nothing in blacksteel yet. Two bars for a blade or legs, three for a body. It wants a steadier hand than steel does. If the anvil refuses you, smith more steel first. That is not an insult. It is the order of things.',
      options: [USE_FORGE, { text: 'I will get to it.', goto: 'end' }]
    },
    steel_done: {
      say: 'I can smell blacksteel on your gloves. So you made something. Did it fight you?',
      options: [
        { text: 'It fought me. I won.', when: { stage: ['sq_steel', 2] }, then: [{ finish: 'sq_steel' }], goto: 'steel_after' },
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    steel_after: {
      say: 'Good. It should fight. Here, four bars of mine, poured slow, so you can see the difference. Make something worth wearing. There are harder metals than this. Not at my forge, and not yet.',
      options: [USE_FORGE, { text: 'Thank you, Reeve.', goto: 'end' }]
    },
    after_all: {
      say: 'You again. Good. The forge is hot and you know which tongs not to touch. When the south-east road opens and better ore comes up it, come and ask me what is harder than blacksteel.',
      options: [USE_FORGE, { text: 'Who are you, when you are not working?', goto: 'tamsin_who' }, { text: 'I will.', goto: 'end' }]
    }
  }
};

// Pell Greaves, cook: loud, generous, suspicious of anything that is not food.
const PELL: Dialogue = {
  npc: 'pell_greaves',
  greet: [
    { when: { stage: ['sq_kettle', 2] }, node: 'kettle_done' },
    { when: { stage: ['sq_kettle', 0] }, node: 'kettle_brief' },
    { when: { stage: ['sq_kettle', 1] }, node: 'kettle_wait' },
    { when: KETTLE_NEEDS, node: 'kettle_offer' },
    { when: { quest: ['sq_kettle', 'done'] }, node: 'brewer' },
    { node: 'hello' }
  ],
  nodes: {
    hello: {
      say: 'You! You look hungry. Everyone who comes through that gate looks hungry. Sit. No, stand, the stool is for the onions. Cook what you catch on my range and nobody gets hurt. What do you want?',
      options: [
        { text: 'Who are you?', goto: 'pell_who' },
        { text: 'What should I cook?', goto: 'pell_cook' },
        { text: 'What is in the fourth kettle?', goto: 'kettle_early' },
        { text: 'Nothing. Carry on.', goto: 'end' }
      ]
    },
    pell_who: {
      say: 'Pell Greaves! I feed this town. Soup, stew, and whatever is left, all day, since before Tolley had that gate. If it is not food I do not trust it. If it is food I can fix it.',
      options: [
        { text: 'What should I cook?', goto: 'pell_cook' },
        { text: 'What do you make of Tolley?', goto: 'pell_tolley' },
        { text: 'Carry on, Pell.', goto: 'end' }
      ]
    },
    pell_cook: {
      say: 'Whatever you caught, before it turns. Small fish first. You will burn a few. Everybody does, and the hens eat the proof. When the small ones stop burning, catch bigger ones. That is the whole trade and I gave it to you for nothing.',
      options: [
        { text: 'Who are you?', goto: 'pell_who' },
        { text: 'Generous of you.', goto: 'end' }
      ]
    },
    pell_tolley: {
      say: 'Bran? He counts people like I count onions, and he frets over every one. Eats standing up. Never finishes a bowl. A man who will not finish a bowl has something on his mind, you mark me.',
      options: [{ text: 'I will mark you.', goto: 'end' }]
    },
    kettle_early: {
      say: 'The camp across the green has three kettles, every one of them stolen. I have a fourth they never got, and it is not for soup, so I do not like to talk about it. Come back when your Cooking is thirty and your combat twenty.',
      options: [
        { text: 'What should I cook until then?', goto: 'pell_cook' },
        { text: 'I will come back.', goto: 'end' }
      ]
    },
    kettle_offer: {
      say: 'You can cook! I can smell it on you, and for once it is not smoke. Listen. The camp across the green has three stolen kettles. I have a fourth, and I am ashamed of it. It is not for food. The altar folk keep asking for a brew.',
      options: [
        { text: 'What is the brew?', when: KETTLE_NEEDS, then: [{ start: 'sq_kettle' }], goto: 'kettle_brief' },
        { text: 'Who are you?', goto: 'pell_who' },
        { text: 'Not now, Pell.', goto: 'end' }
      ]
    },
    kettle_brief: {
      say: 'Prayer restore, they call it. One sting gland, cut from the stingers down in the sand. Two measures of ashes. Simmer it on a range. It smells like a wet dog and it puts the prayer back in a tired head. Brew me one that holds.',
      options: [
        { text: 'One gland, two ashes. I will brew it.', when: { stage: ['sq_kettle', 0] }, then: [{ advance: 'sq_kettle' }], goto: 'end' },
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    kettle_wait: {
      say: 'No brew yet? A gland from the stingers in the sand, ashes from any burnt log. Do not boil it. Simmer. If it goes grey you boiled it, and I will know, because I have boiled every one I ever made.',
      options: [
        { text: 'I am working on it.', goto: 'end' },
        { text: 'What should I cook meanwhile?', goto: 'pell_cook' }
      ]
    },
    kettle_done: {
      say: 'You brewed it? I can smell it on your sleeves. Wet dog. Good! That is right, that is exactly right. Did it hold its colour in the vial?',
      options: [
        { text: 'It held.', when: { stage: ['sq_kettle', 2] }, then: [{ finish: 'sq_kettle' }], goto: 'kettle_after' },
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    kettle_after: {
      say: 'Then you brew better than I do, and I am not too proud to say it loudly. Here. Glands I was saving, and two vials of mine for the road. They are grey. They still work. Now eat something.',
      options: [{ text: 'Thank you, Pell.', goto: 'end' }]
    },
    brewer: {
      say: 'The brewer! Sit. No, stand. There are stronger brews, you know. They want roots from the deep woods that I would not put in a soup. When you can cook them, I will not stop you. I will not taste them either.',
      options: [
        { text: 'What should I cook?', goto: 'pell_cook' },
        { text: 'Who are you, again?', goto: 'pell_who' },
        { text: 'Carry on, Pell.', goto: 'end' }
      ]
    }
  }
};

// Corin Ashby, warden of the cairn: plain, careful. He has watched people go into the pass.
const CORIN: Dialogue = {
  npc: 'corin_ashby',
  greet: [
    { when: { stage: ['ml_wards', 3] }, node: 'wards_end' },
    { when: { combat: 60 }, node: 'warn_high' },
    { when: { combat: 50 }, node: 'warn_mid' },
    { node: 'warn_low' }
  ],
  nodes: {
    wards_end: {
      say: 'From Odalys Venn. I know by the satchel knot; she has tied it the same way for thirty years. Stand here a moment and look where I look. That gap in the ridge is Cinderstep Pass. Now. What did she send you to say?',
      options: [
        { text: 'The town lamp holds.', when: { stage: ['ml_wards', 3] }, then: [{ finish: 'ml_wards' }], goto: 'wards_seen' },
        { text: 'Give me a moment.', goto: 'end' }
      ]
    },
    wards_seen: {
      say: 'That is one, then. Take this. Guild coin, and an ember she left with me for whoever came. Hold it, think of a craft, and it teaches a little. You have seen the pass. That is all she wanted. Do not go in.',
      options: [
        { text: 'Why not?', goto: 'pass_why' },
        { text: 'What is past it?', goto: 'pass_past' },
        { text: 'I will go back to town.', goto: 'end' }
      ]
    },
    warn_low: {
      say: 'I am not going to tell you not to go in. I am going to tell you that the last three who did were better armed than you.',
      options: [
        { text: 'What happened to them?', goto: 'corin_three' },
        { text: 'What is past the pass?', goto: 'pass_past' },
        { text: 'Who are you?', goto: 'corin_who' },
        { text: 'Then I will wait.', goto: 'end' }
      ]
    },
    warn_mid: {
      say: 'You are as well armed now as the last three who went in. That is not a recommendation. If you go, swear a Lantern Vow first, so the pass takes only your pride. I would rather you waited for combat sixty.',
      options: [
        { text: 'What happened to them?', goto: 'corin_three' },
        { text: 'What is past the pass?', goto: 'pass_past' },
        { text: 'Who are you?', goto: 'corin_who' },
        { text: 'I will think on it.', goto: 'end' }
      ]
    },
    warn_high: {
      say: 'You, I would not stop. I will ask you to wait, though. The Lampwright has roads still to light before she sends anyone through that gap with a purpose. When she does, come to me first. I know where the sentries stand.',
      options: [
        { text: 'Why is the pass held?', goto: 'pass_why' },
        { text: 'What is past it?', goto: 'pass_past' },
        { text: 'Who are you?', goto: 'corin_who' },
        { text: 'I will come to you first.', goto: 'end' }
      ]
    },
    pass_why: {
      say: 'It is held. Sentries, and they do not weigh how strong you are before they start. I have watched people walk in angry and people walk in careful. The careful ones I sometimes see again.',
      options: [
        { text: 'What is past it?', goto: 'pass_past' },
        { text: 'I hear you.', goto: 'end' }
      ]
    },
    pass_past: {
      say: 'Ash, and what it leaves. The ground behind the ridge was always bad. Now it is awake. Odalys will tell you the lamps are sick. From here I can tell you what they are sick with. It comes down through that gap, a little more each night.',
      options: [
        { text: 'What is the cairn for?', goto: 'corin_cairn' },
        { text: 'I hear you.', goto: 'end' }
      ]
    },
    corin_three: {
      say: 'Two I did not see again. The third came out at dawn without her shield and would not say what took it. She sat by the cairn until noon and then walked north. I gave her water. It was what I had.',
      options: [
        { text: 'Why is the pass held?', goto: 'pass_why' },
        { text: 'I will remember her.', goto: 'end' }
      ]
    },
    corin_cairn: {
      say: 'It marks where the wards end. Every Lampwright who walked the Stair set one stone on it. The top one is Odalys Venn, eleven years ago. The sign says to go through prepared or not at all. I painted that. I meant it.',
      options: [
        { text: 'Who are you?', goto: 'corin_who' },
        { text: 'I read it.', goto: 'end' }
      ]
    },
    corin_who: {
      say: 'Corin Ashby. I keep the cairn. Someone should stand where the wards end. I count nobody, that is Tolley at the gate. I only remember the faces that go in, and look for them among the faces that come out.',
      options: [
        { text: 'What is the cairn for?', goto: 'corin_cairn' },
        { text: 'A hard post.', goto: 'end' }
      ]
    }
  }
};

// Qadir Salt-Hand, tanner and caravan master: wastes nothing, bargains over everything. His chapter and his craft
// come with later slices; until then he trades and says when to come back.
const QADIR: Dialogue = {
  npc: 'qadir_salthand',
  greet: [
    { when: { all: [{ quest: ['ml_east', 'done'] }, { combat: 50 }] }, node: 'soon' },
    { when: { quest: ['ml_east', 'done'] }, node: 'level' },
    { node: 'hello' }
  ],
  nodes: {
    hello: {
      say: 'A customer, or a pair of hands? Either has a price. I am Qadir. They call me Salt-Hand because I cure hides, and because a coin that reaches my palm stays there. Looking is free today. Only today.',
      options: [SEE_WARES, { text: 'Who are you?', goto: 'who' }, { text: 'Is there work?', goto: 'work_early' }, { text: 'Only looking.', goto: 'end' }]
    },
    who: {
      say: 'Tanner. Caravan master. I take what the sand kills and turn it into what the living wear. Hide, sinew, shell. Nothing wasted. Waste is a debt you pay later. One day I will teach the needle to someone who has earned it.',
      options: [SEE_WARES, { text: 'How do you bargain?', goto: 'bargain' }, { text: 'Another day, then.', goto: 'end' }]
    },
    bargain: {
      say: 'I name a price. You are insulted. You name a price. I am wounded. We both walk away, slowly, and whoever turns round first pays. I have not turned round first since my father died. He taught me.',
      options: [SEE_WARES, { text: 'I will practise walking slowly.', goto: 'end' }]
    },
    work_early: {
      say: 'Work? The Lampwright is mending her lamps, I hear. Her own first, then the east. The salt road is third on her list, so it is third on mine. Come back when the east lamp burns and she speaks your name. Then we bargain.',
      options: [SEE_WARES, { text: 'I will come back.', goto: 'end' }]
    },
    level: {
      say: 'The east lamp burns and the Lampwright speaks your name. Good. That is half the price. The other half is the stalkers on my caravan road, and they would open you like a waterskin. Come back at combat fifty.',
      options: [SEE_WARES, { text: 'Who are you?', goto: 'who' }, { text: 'Fifty. I will come back.', goto: 'end' }]
    },
    soon: {
      say: 'You, I could use. But my caravan is three days late with my needles on it, and I do not bargain with empty hands. Come back when it is in. Until then, buy something. It soothes me.',
      options: [SEE_WARES, { text: 'Who are you?', goto: 'who' }, { text: 'I will come back.', goto: 'end' }]
    }
  }
};

// Hesper Moth, hermit runebinder: she stops in the middle of a sentence and finishes it in her next passage, so every
// passage of hers that ends without a full stop leads only to passages that begin with its last words.
const HESPER: Dialogue = {
  npc: 'hesper_moth',
  greet: [
    { when: { all: [{ quest: ['ml_east', 'done'] }, { combat: 55 }] }, node: 'soon' },
    { node: 'hello' }
  ],
  nodes: {
    hello: {
      say: 'Oh. A person. I was only now saying to the lantern that nobody comes this way unless they are lost, or',
      options: [
        { text: 'Or what?', goto: 'sent' },
        { text: 'I will leave you to the lantern.', goto: 'end' }
      ]
    },
    sent: {
      say: 'sent. Lost, or sent. You do not look lost. So someone sent you, or someone will. I am Hesper Moth, and this is the Hollow. The Lampwrights kept their stones here, when there were Lampwrights enough to',
      options: [
        { text: 'Enough to what?', goto: 'keep' },
        { text: 'I should go.', goto: 'end' }
      ]
    },
    keep: {
      say: 'keep them. Now I keep them. Blank stones, from the outcrop down the road. A rune is only a stone that has been told what it is. I tell them. It is called binding. It is not for today, because I have not',
      options: [
        { text: 'Have not what?', goto: 'when' },
        { text: 'I should go.', goto: 'end' }
      ]
    },
    when: {
      say: 'sorted them. Yes. Come back when the Lampwright has lit the salt road. She will send you here after it. She always sent them here fourth. I will have the stones sorted by then. Probably.',
      options: [
        { text: 'Who are you, out here alone?', goto: 'who' },
        { text: 'You talk to the lantern?', goto: 'lantern' },
        { text: 'I will come back.', goto: 'end' }
      ]
    },
    lantern: {
      say: 'It does not answer. That is what I like in it. It was a wardlight once, the smallest on the Lanternway. Odalys let me keep it when it grew too old to work. We are neither of us much use and we both still',
      options: [
        { text: 'Still what?', goto: 'burn' },
        { text: 'I should go.', goto: 'end' }
      ]
    },
    burn: {
      say: 'burn. A little. Enough to sort stones by.',
      options: [
        { text: 'Who are you, out here alone?', goto: 'who' },
        { text: 'Be well, Hesper.', goto: 'end' }
      ]
    },
    who: {
      say: 'A runebinder. A hermit, they say in town, as if I had chosen the word. I chose the quiet. The word came',
      options: [
        { text: 'Came when?', goto: 'later' },
        { text: 'I should go.', goto: 'end' }
      ]
    },
    later: {
      say: 'later. Words do. I was apprenticed to the lamps once. Odalys could tell you, she tells it better and shorter. I left the ladders for the stones. Stones do not gutter.',
      options: [
        { text: 'You talk to the lantern?', goto: 'lantern' },
        { text: 'Be well, Hesper.', goto: 'end' }
      ]
    },
    soon: {
      say: 'You. Or someone your size, I lose track. The east lamp is lit, I saw the colour change over the trees. But the salt road is dark still, and the stones are not ready, because I have not',
      options: [
        { text: 'Have not what?', goto: 'when' },
        { text: 'I should go.', goto: 'end' }
      ]
    }
  }
};

export const DIALOGUES: Dialogue[] = [BRAN, ODALYS, PELL, TAMSIN, QADIR, HESPER, CORIN];
