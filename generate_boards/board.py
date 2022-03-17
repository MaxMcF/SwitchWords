from random import randint, random, shuffle, choice
from uuid import uuid4
from collections import deque
from graphviz import Digraph
import sqlite3
from retrying import retry
from itertools import product
import argparse
import json


class Letter:
    def __init__(self, val=None, start=False, end=False):
        self.val = val
        self.id = str(uuid4())
        self.ismerge = False
        self.start = start
        self.end = end

    def __str__(self):
        return str(self.val) + '.' + self.id

    def get_dict(self):
        letter_dict = {}
        letter_dict['empty'] = False
        letter_dict['letter'] = self.val
        letter_dict['id'] = self.id
        letter_dict['is_merge'] = self.ismerge
        letter_dict['start'] = self.start
        letter_dict['end'] = self.end
        return letter_dict

class Word:
    def __init__(self, length, game_length, offset, word=None, clue=None):
        self.length = length
        self.game_length = game_length
        self.offset = offset
        self.word = word
        self.clue = clue
        self.word_id = str(uuid4())
        self.letters = []
        first = True
        counter = 1
        for i in range(game_length):
            if offset > 0:
                self.letters.append(None)
                offset -= 1
            elif i >= length + self.offset:
                self.letters.append(None)
            else:
                if first:
                    self.letters.append(Letter(start=True))
                    first = False
                elif counter == length + self.offset:
                    self.letters.append(Letter(end=True))
                else:
                    self.letters.append(Letter())
            counter += 1

    def __len__(self):
        return self.length

    def __str__(self):
        return self.word if self.word else ""


    def get_dict(self):
        output = {}
        output['length'] = self.length
        output['word'] = self.word
        output['word_id'] = self.word_id
        output['offset'] = self.offset
        output['clue'] = self.clue
        output['letters'] = []
        for i, letter in enumerate(self.letters):
            if not letter:
                letter_dict = {}
                letter_dict['empty'] = True
            else:
                letter_dict = letter.get_dict()
            letter_dict['position'] = i
            output['letters'].append(letter_dict)
        return output

    def set_word(self, word):
        assert len(word) == self.length
        self.word = word


class Board:
    def __init__(
        self,
        num_words,
        len_min,
        len_max,
        ol_rate=0.7,
    ):
        self.id = str(uuid4())
        self.num_words = num_words
        self.len_min = len_min
        self.len_max = len_max
        self.ol_rate = ol_rate
        self.conn = create_cursor()
        self.words = []

        word_lengths = sorted([randint(len_min, len_max) for _ in range(num_words)])

        self.game_length = max(word_lengths)
        base_word = word_lengths[-1]
       
        base_word_obj = Word(length=base_word, game_length=self.game_length, offset=0)
        self.words.append(base_word_obj)

        for length in word_lengths[:-1]:
            probs = self.gen_probs(length)
            diff_len = randint(0, base_word - length)
            word_obj = Word(length=length, game_length=self.game_length, offset=diff_len)
            first = True
            offset = 0
            for i, (let, let_b) in enumerate(zip(word_obj.letters, base_word_obj.letters)):
                if not let:
                    offset += 1
                else:
                    merge_prob = probs.pop()
                    if merge_prob >= 1 - ol_rate and not first and i != length + offset - 1:
                        word_obj.letters[i] = base_word_obj.letters[i]
                        word_obj.letters[i].ismerge = True
                    if first:
                        first = False
            self.words.append(word_obj)

    def gen_probs(self, length):
        """
        Game constraint: Each word should have its own independent head, and independent tail.
        """
        probs = [random() for _ in range(length-1)]
        num_s = probs.pop()
        num_e = probs.pop()
        probs.append(1)
        shuffle(probs)
        return [num_s] + probs + [num_e]

    def visualize_struct(self):
        dot = Digraph()
        colors = ['red', 'blue', 'green', 'yellow', 'purple']
        for ind, word in enumerate(self.words):
            letter_cleaned = [word for word in word.letters if word]
            for letter in letter_cleaned:
                dot.node(str(letter), label=letter.val)
            for i in range(len(word.letters[:-1])):
                if word.letters[i] and word.letters[i+1]:
                    dot.edge(str(word.letters[i]), str(word.letters[i+1]), color=colors[ind])
        dot.render(view=True)

    def populate_board(self):
        base = self.words[0]

        valid_words = self.query_db(
            f"SELECT * FROM words WHERE length(word) = {base.length}"
        )
        base_word_row = choice(valid_words)
        base_word = base_word_row[0]
        clue = base_word_row[-1]
        self.words[0].word = base_word
        self.words[0].clue = clue
        i = 0
        for letter in self.words[0].letters:
            if letter:
                letter.val = base_word[i]
                i += 1            


        found_words = [base_word]
        ignore_position_query = {}
        for word in self.words[1:]:
            position_query = {}
            i = 0
            for letter in word.letters:
                if letter:
                    if letter in self.words[0].letters:
                        position_query[i+1] = letter.val
                    i += 1

            query = f"SELECT * FROM words WHERE length(word) = {word.length}"
            for pos, let in position_query.items():
                query += f" AND letter{pos} = '{let}' "
            for pos, let in ignore_position_query.items():
                query += f" AND letter{pos} != '{let}' "
            for f_word in found_words:
                query += f" AND word != '{f_word}' "
            query += ";"
            valid_words = self.query_db(query)
            new_word = choice(valid_words)
            found_words.append(new_word[0])
            word.word = new_word[0]
            word.clue = new_word[-1]

            i = 0
            for letter in word.letters:
                if letter:
                    letter.val = new_word[0][i]
                    i += 1  
            
            i = 0
            for letter in word.letters:
                if letter:
                    if letter in self.words[0].letters:
                        ignore_position_query[i+1] = letter.val
                    i += 1


    def query_db(self, query):
        cursor = self.conn.cursor()
        cursor.execute(query)
        return cursor.fetchall()

    def merge_letters(self):
        for i in range(self.game_length):
            for j, k in product(range(len(self.words)), range(len(self.words))):
                if j != k and self.words[j].letters[i] and self.words[k].letters[i]:
                    if self.words[j].letters[i].val == self.words[k].letters[i].val:
                        if not self.words[j].letters[i].start and not self.words[k].letters[i].start:
                            if (not self.words[j].letters[i].end and not self.words[k].letters[i].end) or (self.words[j].letters[i].end and self.words[k].letters[i].end):
                                self.words[j].letters[i] = self.words[k].letters[i]
                                self.words[j].letters[i].ismerge = True
                    
    
    def create_json(self):
        output = {'nodes': [], 'node_lookup': {}, 'edges': {}, 'edge_lookup': {}, 'formatted_edges': [], 'game_length': self.game_length}
        for word in self.words:
            output['nodes'].append(word.get_dict())
            for i in range(len(word.letters)):
                if word.letters[i]:
                    output['node_lookup'][str(word.letters[i].id)] = word.letters[i].get_dict()
                    output['edges'][str(word.letters[i].id)] = output['edges'].get(str(word.letters[i].id), [])
                    if i-1 >= 0 and word.letters[i-1]:
                        if str(word.letters[i-1].id) not in output['edges'][str(word.letters[i].id)]:
                            output['edge_lookup'][str(word.letters[i].id)+'-'+str(word.letters[i-1].id)] = word.word
                            output['edges'][str(word.letters[i].id)].append(str(word.letters[i-1].id))
        
        # import pdb; pdb.set_trace()

        output['formatted_edges'] = []
        for node_id, parent_ids in output['edges'].items():
            output['formatted_edges'].append({'id': node_id, 'parentIds': parent_ids})
        del output['edges']

        with open(f'../boards/sample.json', 'w') as f:
            f.write(json.dumps(output, indent=4, sort_keys=True))
        # with open(f'../boards/{self.num_words}_{self.len_min}_{self.len_max}_{self.ol_rate}_{self.id}.json', 'w') as f:
        #     f.write(json.dumps(output, indent=4, sort_keys=True))


def create_cursor():
    con = sqlite3.connect("wordsDict.db")

    return con


def main(num_letters, min_length, max_length, ol_rate):
    
    find = True
    b = Board(num_letters, min_length, max_length, ol_rate)
    b.populate_board()
    # while find:
    #     b = Board(num_letters, min_length, max_length, ol_rate)
    #     print('new board -----------------------------------')
    #     counter = 0
    #     while counter < 50 and find:
    #         try: 
    #             counter += 1
    #             b.populate_board()
    #             find = False
    #         except:
    #             pass
    
    b.merge_letters()
    b.create_json()
    b.visualize_struct()
    b.conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('num_letters', metavar='N', type=int,
                    help='Input the number of words for a board')
    parser.add_argument('min_length', metavar='min', type=int,
                    help='Minimum length of the auto generated words')
    parser.add_argument('max_length', metavar='min', type=int,
                    help='Maximum length of the auto generated words')
    parser.add_argument('--ol_rate', default=0.3, type=float,
                    help='Overlap rate as a percentage (default: thirty percent - 0.3)')
    args = parser.parse_args()
    main(args.num_letters, args.min_length, args.max_length, args.ol_rate)