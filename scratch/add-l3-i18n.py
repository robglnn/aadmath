#!/usr/bin/env python3
"""Add Algebra I Level 3's names to src/i18n/{en,es,pl}.js.

ADDITIVE ONLY. Three blocks per locale, each inserted immediately after the
Level 2 block it extends: the skill names, the unit title, the one-line big
idea the report prints per line, and the plain-language name of each slip the
report can show a teacher. Nothing existing is edited or moved.
"""
import io, re, sys

SKILLS = {
 'en': [
  ("function-notation",      "Function notation"),
  ("domain-range",           "Domain and range"),
  ("exponent-product",       "Multiplying powers"),
  ("exponent-power",         "A power of a power"),
  ("exponent-quotient",      "Dividing powers"),
  ("zero-negative-exponent", "Zero and negative powers"),
  ("poly-add-sub",           "Adding and subtracting polynomials"),
  ("poly-multiply",          "Multiplying binomials"),
  ("factor-common",          "Taking out a common factor"),
  ("linear-vs-exponential",  "Linear against exponential growth"),
  ("exponential-rule",       "Exponential rules"),
 ],
 'es': [
  ("function-notation",      "Notación de función"),
  ("domain-range",           "Dominio y rango"),
  ("exponent-product",       "Multiplicar potencias"),
  ("exponent-power",         "Potencia de una potencia"),
  ("exponent-quotient",      "Dividir potencias"),
  ("zero-negative-exponent", "Exponente cero y negativo"),
  ("poly-add-sub",           "Sumar y restar polinomios"),
  ("poly-multiply",          "Multiplicar binomios"),
  ("factor-common",          "Sacar el factor común"),
  ("linear-vs-exponential",  "Crecimiento lineal o exponencial"),
  ("exponential-rule",       "Reglas exponenciales"),
 ],
 'pl': [
  ("function-notation",      "Zapis funkcyjny"),
  ("domain-range",           "Dziedzina i zbiór wartości"),
  ("exponent-product",       "Mnożenie potęg"),
  ("exponent-power",         "Potęga potęgi"),
  ("exponent-quotient",      "Dzielenie potęg"),
  ("zero-negative-exponent", "Wykładnik zero i ujemny"),
  ("poly-add-sub",           "Dodawanie i odejmowanie wielomianów"),
  ("poly-multiply",          "Mnożenie dwumianów"),
  ("factor-common",          "Wyłączanie wspólnego czynnika"),
  ("linear-vs-exponential",  "Wzrost liniowy a wykładniczy"),
  ("exponential-rule",       "Reguły wykładnicze"),
 ],
}

UNIT = {
 'en': "Level 3 — Name, Power and Form",
 'es': "Nivel 3 — Nombre, potencia y forma",
 'pl': "Poziom 3 — Nazwa, potęga i postać",
}

IDEA = {
 'en': [
  ("function-notation",      "A rule can have a name, and f(3) is the output it gives at 3."),
  ("domain-range",           "The inputs a rule takes are its domain; the outputs it gives are its range."),
  ("exponent-product",       "A power counts factors, so multiplying two powers adds the counts."),
  ("exponent-power",         "Raising a power to a power brings the same count again, so the counts multiply."),
  ("exponent-quotient",      "Dividing powers cancels matching factors, so the bottom count comes off the top."),
  ("zero-negative-exponent", "A count of zero means one, and a negative count means factors under the bar."),
  ("poly-add-sub",           "Only terms with the same count merge, and a minus reaches every term in the bracket."),
  ("poly-multiply",          "Every term in the first bracket multiplies every term in the second."),
  ("factor-common",          "Factoring is expanding read backwards: take out the most every term shares."),
  ("linear-vs-exponential",  "A straight rule adds the same amount; a growing rule multiplies by the same factor."),
  ("exponential-rule",       "A start multiplied by a factor once per step — and at zero steps, the start."),
 ],
 'es': [
  ("function-notation",      "Una regla puede tener nombre, y f(3) es la salida que da en 3."),
  ("domain-range",           "Las entradas que acepta una regla son su dominio; las salidas que da son su rango."),
  ("exponent-product",       "Una potencia cuenta factores, así que multiplicar dos potencias suma los exponentes."),
  ("exponent-power",         "Elevar una potencia trae otra vez el mismo exponente, así que los exponentes se multiplican."),
  ("exponent-quotient",      "Dividir potencias cancela factores iguales, así que el exponente de abajo se resta al de arriba."),
  ("zero-negative-exponent", "Un exponente cero vale uno, y uno negativo pone factores debajo de la barra."),
  ("poly-add-sub",           "Solo se juntan los términos con el mismo exponente, y el menos alcanza a todo el paréntesis."),
  ("poly-multiply",          "Cada término del primer paréntesis multiplica a cada término del segundo."),
  ("factor-common",          "Factorizar es expandir al revés: saca todo lo que comparten los términos."),
  ("linear-vs-exponential",  "Una regla recta suma lo mismo; una regla que crece multiplica por el mismo factor."),
  ("exponential-rule",       "Un principio multiplicado por un factor una vez por paso, y en cero pasos, el principio."),
 ],
 'pl': [
  ("function-notation",      "Reguła może mieć nazwę, a f(3) to wyjście, które daje przy 3."),
  ("domain-range",           "Wejścia, które reguła przyjmuje, to jej dziedzina; wyjścia to zbiór wartości."),
  ("exponent-product",       "Potęga liczy czynniki, więc mnożenie dwóch potęg dodaje wykładniki."),
  ("exponent-power",         "Potęga potęgi przynosi ten sam wykładnik jeszcze raz, więc wykładniki się mnożą."),
  ("exponent-quotient",      "Dzielenie potęg skraca te same czynniki, więc dolny wykładnik odchodzi od górnego."),
  ("zero-negative-exponent", "Wykładnik zero znaczy jeden, a ujemny kładzie czynniki pod kreską."),
  ("poly-add-sub",           "Łączą się tylko wyrazy o tym samym wykładniku, a minus sięga całego nawiasu."),
  ("poly-multiply",          "Każdy wyraz pierwszego nawiasu mnoży każdy wyraz drugiego."),
  ("factor-common",          "Wyłączanie to mnożenie czytane wstecz: wyjmij wszystko, co wyrazy dzielą."),
  ("linear-vs-exponential",  "Prosta reguła dodaje tyle samo; rosnąca mnoży przez ten sam czynnik."),
  ("exponential-rule",       "Start pomnożony przez czynnik raz na krok, a przy zerze kroków — sam start."),
 ],
}

SLIP = {
 'en': [
  ("base-times-exponent",              "Multiplies the base by the count above it"),
  ("bases-multiplied",                 "Multiplies the bases as well as handling the counts"),
  ("coefficient-not-raised",           "Raises the letter and leaves the number in front alone"),
  ("coefficients-added",               "Adds the numbers in front instead of multiplying them"),
  ("exponents-added",                  "Adds the counts where the rule multiplies them"),
  ("exponents-multiplied",             "Multiplies the counts where the rule adds them"),
  ("exponents-subtracted-wrong-way",   "Takes the counts away the wrong way round"),
  ("factor-drops-term",                "Divides one term by the common factor and leaves another"),
  ("factor-partial",                   "Takes out part of the common factor only"),
  ("growth-is-linear",                 "Adds the factor at each step instead of multiplying"),
  ("growth-start-for-factor",          "Gives the starting amount when asked for the factor"),
  ("input-output-swap",                "Answers with the input instead of the output"),
  ("middle-term-missed",               "Multiplies the ends and misses the middle terms"),
  ("minus-first-term-only",            "Lets a minus reach only the first term in the bracket"),
  ("negative-power-is-negative",       "Reads a negative count as a negative answer"),
  ("negative-power-is-reciprocal-slip", "Puts the power on the wrong side of the bar"),
  ("range-ends-swapped",               "Reads the output at the wrong end of the inputs"),
  ("zero-power-is-zero",               "Reads a count of zero as an answer of zero"),
 ],
 'es': [
  ("base-times-exponent",              "Multiplica la base por el exponente de encima"),
  ("bases-multiplied",                 "Multiplica también las bases, además de los exponentes"),
  ("coefficient-not-raised",           "Eleva la letra y deja el número de delante igual"),
  ("coefficients-added",               "Suma los números de delante en vez de multiplicarlos"),
  ("exponents-added",                  "Suma los exponentes donde la regla los multiplica"),
  ("exponents-multiplied",             "Multiplica los exponentes donde la regla los suma"),
  ("exponents-subtracted-wrong-way",   "Resta los exponentes al revés"),
  ("factor-drops-term",                "Divide un término por el factor común y deja otro sin dividir"),
  ("factor-partial",                   "Saca solo una parte del factor común"),
  ("growth-is-linear",                 "Suma el factor en cada paso en vez de multiplicar"),
  ("growth-start-for-factor",          "Da la cantidad inicial cuando se pide el factor"),
  ("input-output-swap",                "Responde con la entrada en vez de la salida"),
  ("middle-term-missed",               "Multiplica los extremos y se salta los términos de en medio"),
  ("minus-first-term-only",            "Deja que el menos alcance solo al primer término del paréntesis"),
  ("negative-power-is-negative",       "Lee un exponente negativo como una respuesta negativa"),
  ("negative-power-is-reciprocal-slip", "Pone la potencia en el lado equivocado de la barra"),
  ("range-ends-swapped",               "Lee la salida en el extremo equivocado de las entradas"),
  ("zero-power-is-zero",               "Lee un exponente cero como una respuesta de cero"),
 ],
 'pl': [
  ("base-times-exponent",              "Mnoży podstawę przez wykładnik nad nią"),
  ("bases-multiplied",                 "Mnoży także podstawy, nie tylko wykładniki"),
  ("coefficient-not-raised",           "Podnosi literę, a liczbę z przodu zostawia"),
  ("coefficients-added",               "Dodaje liczby z przodu zamiast je pomnożyć"),
  ("exponents-added",                  "Dodaje wykładniki tam, gdzie reguła je mnoży"),
  ("exponents-multiplied",             "Mnoży wykładniki tam, gdzie reguła je dodaje"),
  ("exponents-subtracted-wrong-way",   "Odejmuje wykładniki w odwrotną stronę"),
  ("factor-drops-term",                "Dzieli jeden wyraz przez wspólny czynnik, a drugi zostawia"),
  ("factor-partial",                   "Wyłącza tylko część wspólnego czynnika"),
  ("growth-is-linear",                 "Dodaje czynnik na każdym kroku zamiast mnożyć"),
  ("growth-start-for-factor",          "Podaje wartość startową, gdy pytamy o czynnik"),
  ("input-output-swap",                "Odpowiada wejściem zamiast wyjściem"),
  ("middle-term-missed",               "Mnoży skrajne wyrazy i pomija środkowe"),
  ("minus-first-term-only",            "Pozwala minusowi sięgnąć tylko pierwszego wyrazu w nawiasie"),
  ("negative-power-is-negative",       "Czyta ujemny wykładnik jako ujemną odpowiedź"),
  ("negative-power-is-reciprocal-slip", "Umieszcza potęgę po złej stronie kreski ułamka"),
  ("range-ends-swapped",               "Czyta wyjście na złym końcu zakresu wejść"),
  ("zero-power-is-zero",               "Czyta wykładnik zero jako odpowiedź zero"),
 ],
}

BANNER = {
 'en': "    // Level 3 (content/graph/algebra1-l3.json).",
 'es': "    // Nivel 3 (content/graph/algebra1-l3.json).",
 'pl': "    // Poziom 3 (content/graph/algebra1-l3.json).",
}

def esc(s):
    return s.replace("\\", "\\\\").replace("'", "\\'")

def insert_after(src, anchor, block):
    i = src.index(anchor)
    j = src.index("\n", i) + 1
    return src[:j] + block + src[j:]

for loc in ('en', 'es', 'pl'):
    path = f'src/i18n/{loc}.js'
    src = io.open(path, encoding='utf-8').read()
    if "'exponent-product'" in src:
        print(f'{loc}: already carries Level 3 — skipped')
        continue

    # 1. skill names, straight after the last Level 2 skill name
    block = BANNER[loc][:-1] + "\n"
    block = "    // Level 3 (content/graph/algebra1-l3.json). Additive: a unit that is\n" \
            "    // not loaded costs three strings and changes nothing on screen.\n" if loc == 'en' else \
            f"{BANNER[loc]}\n"
    for k, v in SKILLS[loc]:
        block += f"    '{k}': '{esc(v)}',\n"
    src = insert_after(src, f"    'system-elimination': ", block)

    # 2. the unit title
    src = insert_after(src, "    'algebra1-l2': { title:",
                       f"    'algebra1-l3': {{ title: '{esc(UNIT[loc])}' }},\n")

    # 3. the one-line idea the report prints per line
    block = f"      {BANNER[loc].strip()}\n"
    for k, v in IDEA[loc]:
        block += f"      '{k}': '{esc(v)}',\n"
    src = insert_after(src, f"      'system-elimination': ", block)

    # 4. the plain-language name of each new slip
    block = f"      {BANNER[loc].strip()}\n"
    for k, v in SLIP[loc]:
        block += f"      '{k}': '{esc(v)}',\n"
    # the slip table is the SECOND 'x-and-x-squared' — the first is an echo line
    last = src.rindex("      'x-and-x-squared': ")
    j = src.index("\n", last) + 1
    src = src[:j] + block + src[j:]

    io.open(path, 'w', encoding='utf-8').write(src)
    print(f'{loc}: added {len(SKILLS[loc])} skill names, 1 unit title, {len(IDEA[loc])} ideas, {len(SLIP[loc])} slips')
